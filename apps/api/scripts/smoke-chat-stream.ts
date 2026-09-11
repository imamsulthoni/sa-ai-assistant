const apiUrl = process.env.API_URL ?? "http://localhost:8000";
const userId = `stream-smoke-${Date.now()}`;

const sessionResponse = await fetch(`${apiUrl}/sessions`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-user-id": userId },
  body: "{}",
});
if (!sessionResponse.ok) throw new Error(`Session setup failed: ${sessionResponse.status}`);
const session = (await sessionResponse.json()) as { session: { id: string } };

const streamResponse = await fetch(`${apiUrl}/chat/flow-stream`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-user-id": userId,
    "x-conversation-id": session.session.id,
  },
  body: JSON.stringify({
    type: "messages",
    messages: [
      {
        id: "smoke-message",
        role: "user",
        parts: [{ type: "text", text: "Draft a BRD for payment login" }],
      },
    ],
    metadata: { phase: "CLARIFY" },
  }),
});
if (!streamResponse.ok || !streamResponse.body) {
  throw new Error(`Stream request failed: ${streamResponse.status}`);
}
const body = await streamResponse.text();
if (!body.includes('"name":"clarification"') || !body.includes('"status":"completed"')) {
  throw new Error("Stream did not contain the expected clarification and completion events");
}

const invalidResponse = await fetch(`${apiUrl}/chat/flow-stream`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-user-id": userId },
  body: JSON.stringify({ type: "invalid" }),
});
if (invalidResponse.status !== 400) {
  throw new Error(`Invalid stream request returned ${invalidResponse.status}, expected 400`);
}

console.log("chat stream smoke: PASS");
