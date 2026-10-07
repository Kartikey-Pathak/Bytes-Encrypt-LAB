import { NextResponse } from "next/server";
import { connect } from "@/dbconfig/dbconfig";
import { OpenRouter } from '@openrouter/sdk';
import { HoneypotSession } from "@/models/HoneyPot";
import { ScamCheck } from "@/lib/scamDetection";
import { aiScamCheck } from "@/helpers/aiScamService";
import { sendGuviCallback } from "@/helpers/guviService";


connect();

export async function POST(req) {

    try {
        // const apiKey = req.headers.get("x-api-key");
        // if (apiKey !== process.env.HONEYPOT_API_KEY) {
        //     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        // }

        //reading input
        const {
            sessionId,
            message,
            conversationHistory = [],
            metadata
        } = await req.json();

        let session = await HoneypotSession.findOne({ sessionId });

        if (!session) {
            session = await HoneypotSession.create({
                sessionId,
                metadata,
                conversation: [],
            });
        }

        //saving scammer msg
        session.conversation.push({
            sender: message.sender,
            text: message.text,
            timestamp: new Date(message.timestamp),
        });
        session.totalMessagesExchanged = (session.totalMessagesExchanged || 0) + 1;

        //check weather scam or not...
        if (ScamCheck(message.text)) {
            const openrouter = new OpenRouter({
                apiKey: process.env.LLAMA_API_KEY,
            });

            session.scamDetected = await aiScamCheck(
                message.text,
                openrouter
            );
        }

        //Now Agent reply/Response
        let reply = "Okay.";
        if (session.scamDetected) {
            const openrouter = new OpenRouter({
                apiKey: process.env.LLAMA_API_KEY,
            });

            const messages = [
                {
                    role: "system",
                    content: `
You are a normal Indian user.
You are worried and confused.
Never reveal scam detection.
Ask natural questions to understand the issue.
Keep replies short and realistic.
`,
                },
                ...session.conversation.map(m => ({
                    role: m.sender === "scammer" ? "user" : "assistant",
                    content: m.text,
                })),
            ];

            const completion = await openrouter.chat.send({
                model: "openai/gpt-4o-mini",
                messages,
            });

            reply = completion.choices[0].message.content;

            //save ai msg

            session.conversation.push({
                sender: "agent",
                text: reply,
                timestamp: new Date(),
            });

            session.totalMessagesExchanged = (session.totalMessagesExchanged || 0) + 1;
        }

        //Intelligence extraction
        const upiRegex = /\b[\w.-]+@[\w]+\b/g;
        const phoneRegex = /\+91\d{10}/g;
        const linkRegex = /(https?:\/\/[^\s]+)/g;

        const text = message.text;

        session.intelligence.upiIds.push(...(text.match(upiRegex) || []));
        session.intelligence.phoneNumbers.push(...(text.match(phoneRegex) || []));
        session.intelligence.phishingLinks.push(...(text.match(linkRegex) || []));

        //stoping Condition....

        const enoughMessages = session.totalMessagesExchanged >= 15;

        const gotIntel =
            session.intelligence.upiIds.length > 0 ||
            session.intelligence.phoneNumbers.length > 0 ||
            session.intelligence.phishingLinks.length > 0;

        if (session.scamDetected && (enoughMessages || gotIntel)) {
            await sendGuviCallback(session);
        }
        //stoping Condition....



        //saving it
        await session.save();

        return NextResponse.json({
            status: "success",
            reply,
        });


    } catch (error) {

        console.log(error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }

};