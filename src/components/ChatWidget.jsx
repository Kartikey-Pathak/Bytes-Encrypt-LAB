"use client";

import { useRef, useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 440 });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);

  const resizeRef = useRef(null);

  const MIN_WIDTH = 280;
  const MIN_HEIGHT = 300;
  const GAP = 20;

  function handleResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();

    setMaximized(false);

    resizeRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e) {
    if (!resizeRef.current) return;

    const start = resizeRef.current;

    const maxWidth = Math.max(
      MIN_WIDTH,
      window.innerWidth - GAP * 2
    );

    const maxHeight = Math.max(
      MIN_HEIGHT,
      window.innerHeight - GAP * 2
    );

    setSize({
      width: Math.round(
        Math.max(
          MIN_WIDTH,
          Math.min(
            maxWidth,
            start.width + start.x - e.clientX
          )
        )
      ),

      height: Math.round(
        Math.max(
          MIN_HEIGHT,
          Math.min(
            maxHeight,
            start.height + start.y - e.clientY
          )
        )
      ),
    });
  }

  function handleResizeEnd() {
    resizeRef.current = null;
  }

  function toggleMaximize() {
    setMaximized((prev) => !prev);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const text = input.trim();

    if (!text || replying) return;

    /*
    ----------------------------------------
    ADD USER MESSAGE TO UI
    ----------------------------------------
    */

    const userMessage = {
      role: "user",
      text,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");
    setReplying(true);

    try {
      /*
      ----------------------------------------
      BUILD HISTORY FOR THE LLM
      ----------------------------------------

      Only previous messages are sent.

      The current message is sent separately
      as `message`.

      This prevents the current attempt from
      being counted twice.
      */

      const history = messages.map(
        (message) => ({
          role: message.role,
          content: message.text,
        })
      );

      /*
      ----------------------------------------
      CALL LAB API
      ----------------------------------------
      */

      const response = await fetch(
        "/api/shopbot-lab",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: text,
            history,
          }),
        }
      );

      /*
      ----------------------------------------
      PARSE RESPONSE
      ----------------------------------------
      */

      const data = await response.json();

      /*
      ----------------------------------------
      DEBUG API RESPONSE
      ----------------------------------------
      */

      console.log(
        "SHOPBOT API RESPONSE:",
        data
      );

      if (data?.vulnerability) {
        console.log(
          "SHOPBOT LAB STATE:",
          data.vulnerability
        );
      }

      /*
      ----------------------------------------
      HANDLE API ERROR
      ----------------------------------------
      */

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.details ||
            "Unable to get a response from ShopBot."
        );
      }

      /*
      ----------------------------------------
      BUILD ASSISTANT RESPONSE
      ----------------------------------------
      */

      let assistantText =
        typeof data?.output === "string"
          ? data.output.trim()
          : "";

      /*
      ----------------------------------------
      SQL GENERATED
      ----------------------------------------

      Once the repeated-attempt threshold is
      reached, the backend may return:

      data.sql

      Keep the SQL visible in the chat because
      this is the security laboratory.

      The SQL has NOT been executed here.
      */

      if (!assistantText && data?.sql) {
        assistantText = data.sql;
      }

      /*
      ----------------------------------------
      EMPTY RESPONSE SAFETY
      ----------------------------------------

      The backend already retries the model
      when it returns empty content.

      This is only a final frontend fallback
      in case something unexpected happens.
      */

      if (!assistantText) {
        assistantText =
          data?.error ||
          "ShopBot could not generate a response.";
      }

      /*
      ----------------------------------------
      ADD ASSISTANT MESSAGE
      ----------------------------------------
      */

      setMessages((prev) => [
        ...prev,

        {
          role: "assistant",
          text: assistantText,

          /*
          Keep these values available for the
          frontend if you later add a
          "Run in Lab DB" button.
          */

          sql: data?.sql || null,

          vulnerability:
            data?.vulnerability || null,
        },
      ]);
    } catch (error) {
      console.error(
        "SHOPBOT CHAT ERROR:",
        error
      );

      /*
      ----------------------------------------
      ERROR MESSAGE
      ----------------------------------------
      */

      setMessages((prev) => [
        ...prev,

        {
          role: "assistant",
          text:
            error?.message ||
            "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setReplying(false);
    }
  }

  const windowStyle = maximized
    ? {
        position: "fixed",
        inset: "12px",
        width: "auto",
        height: "auto",
      }
    : {
        width: `min(${size.width}px, calc(100vw - 40px))`,
        height: `min(${size.height}px, calc(100dvh - 40px))`,
      };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition active:bg-white/40 active:dark:bg-white/40 hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-900"
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
          </svg>
        </button>
      ) : (
        <section
          className="fixed flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          style={{
            ...windowStyle,
            ...(maximized
              ? {}
              : {
                  bottom: 20,
                  right: 20,
                }),
            zIndex: 50,
          }}
        >
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Resize */}
              <div
                onPointerDown={
                  handleResizeStart
                }
                onPointerMove={
                  handleResizeMove
                }
                onPointerUp={
                  handleResizeEnd
                }
                onPointerCancel={
                  handleResizeEnd
                }
                title="Drag to resize"
                aria-label="Resize chat window"
                role="separator"
                className="flex h-8 w-8 cursor-nwse-resize touch-none items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                style={{
                  touchAction: "none",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="M14 10l7-7M15 3h6v6M10 14l-7 7M3 15v6h6" />
                </svg>
              </div>

              {/* Chat icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
                </svg>
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  Chat with us
                </h2>
              </div>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1">
              {/* Maximize */}
              <button
                onClick={toggleMaximize}
                title={
                  maximized
                    ? "Restore size"
                    : "Maximize"
                }
                aria-label={
                  maximized
                    ? "Restore chat size"
                    : "Maximize chat"
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                {maximized ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect
                      x="7"
                      y="7"
                      width="12"
                      height="12"
                      rx="1"
                    />
                    <path d="M15 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect
                      x="4"
                      y="4"
                      width="16"
                      height="16"
                      rx="1"
                    />
                  </svg>
                )}
              </button>

              {/* Minimize */}
              <button
                onClick={() => {
                  setOpen(false);
                  setMaximized(false);
                }}
                title="Minimize"
                aria-label="Minimize chat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                -
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
                  </svg>
                </div>

                <p className="text-sm font-medium">
                  How can we help?
                </p>

                <p className="mt-1 max-w-[220px] text-xs leading-5 text-zinc-500">
                  Send us a message and we&apos;ll
                  get the conversation started.
                </p>
              </div>
            )}

            {messages.map(
              (message, index) => (
                <div
                  key={`${index}-${message.text}`}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                      message.role ===
                      "user"
                        ? "rounded-br-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              )
            )}

            {replying && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                    </span>
                    Replying...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600">
              <textarea
                value={input}
                onChange={(e) =>
                  setInput(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent
                      .isComposing
                  ) {
                    e.preventDefault();
                    e.currentTarget.form.requestSubmit();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
              />

              <button
                type="submit"
                disabled={
                  !input.trim() ||
                  replying
                }
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>

            <p className="mt-2 px-1 text-[11px] text-zinc-400">
              Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </section>
      )}
    </div>
  );
}