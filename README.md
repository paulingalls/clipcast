# bun-react-tailwind-shadcn-template

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

## Testnet payment (manual)

Prove an end-to-end x402 payment: a real $0.10 USDC payment on **Base Sepolia**
drives `POST /api/generate` and returns a rendered video. This is a manual,
live-testnet check — it settles on-chain and is **not** part of `bun test`.

1. **Fund a client wallet.** Create a Base Sepolia test wallet and get testnet
   USDC from the [Circle faucet](https://faucet.circle.com/) (select Base Sepolia).
2. **Configure `.env`** (copy from `.env.example`; never commit it):

   ```bash
   WALLET_ADDRESS=0xYourReceivingAddress   # server payTo — receives the $0.10
   CLIENT_PRIVATE_KEY=0xYourFundedTestKey  # client wallet that pays (gitignored)
   SERVER_URL=http://localhost:3000        # where the server is reachable
   RPC_URL=                                # optional Base Sepolia RPC override
   ```

3. **Start the server** (must have `WALLET_ADDRESS` set so the payment gate is active):

   ```bash
   bun run start
   ```

4. **Run the payment script** in another terminal:

   ```bash
   bun run pay-gen
   ```

   It POSTs phrases to `/api/generate`, receives a `402`, signs the exact-EVM
   payment, retries, and — once the facilitator settles on-chain — prints the
   render result and confirms the returned video is playable.

---

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
