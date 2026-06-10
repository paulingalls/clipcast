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

Payments use the x402 **exact** scheme over USDC's EIP-3009
`transferWithAuthorization`: the client only **signs** the payment, and the
facilitator submits the transaction and pays the gas. So your test wallet needs
**testnet USDC only — no testnet ETH for gas.**

### 1. Create a test wallet

Generate a throwaway keypair with viem (already a dependency). **Use this only
for testnet** — never reuse a real key:

```bash
bun -e "import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts'; const k=generatePrivateKey(); console.log('PRIVATE_KEY:', k); console.log('ADDRESS:    ', privateKeyToAccount(k).address)"
```

Save both lines. The `ADDRESS` is what you fund; the `PRIVATE_KEY` goes in `.env`.

### 2. Fund it with testnet USDC

Get Base Sepolia USDC for that `ADDRESS` from the
[Circle faucet](https://faucet.circle.com/) (select **Base Sepolia**). A single
faucet drip is far more than the $0.10 per request. No ETH needed (see above).

### 3. Configure `.env`

Copy `.env.example` to `.env` (it is gitignored — never commit it) and set:

```bash
WALLET_ADDRESS=0xYourReceivingAddress   # server payTo — where the $0.10 lands.
                                        # Any address you control: a second
                                        # wallet, or reuse the test ADDRESS above.
CLIENT_PRIVATE_KEY=0xThePrivateKey      # PRIVATE_KEY from step 1 (the payer)
SERVER_URL=http://localhost:3000        # where the running server is reachable
RPC_URL=                                # optional Base Sepolia RPC override
```

### 4. Start the server

`bun run start` runs in production mode, which **requires** `WALLET_ADDRESS` —
this is what activates the payment gate (without it the server exits with an
error rather than running ungated):

```bash
bun run start
```

### 5. Run the payment script

In a second terminal:

```bash
bun run pay-gen
```

It POSTs phrases to `/api/generate`, receives a `402` challenge, signs the
exact-EVM payment, retries, and — once the facilitator settles on-chain —
prints the render result and confirms the returned video is playable. A
successful run ends with `✓ Payment settled…` and `✓ Video is playable…`; any
failure prints `✗ <reason>` and exits non-zero.

---

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
