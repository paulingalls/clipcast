# Clipcast — Setup & External Dependencies

Everything you need to set up outside the codebase to run Clipcast as a real business.

---

## 1. Wallet (Receiving Payments)

x402 payments settle as USDC directly into your wallet. You need an EVM-compatible wallet address on Base (starts with `0x`). You do **not** need a Coinbase account to use x402, but Coinbase's tooling makes the payment-to-bank pipeline simpler.

### Option A: Coinbase Business Account (Recommended for a real business)

This is the path Coinbase explicitly recommends for x402 sellers who want to convert USDC to USD and deposit to a bank account.

1. **Create a Coinbase Business account** at [business.coinbase.com](https://business.coinbase.com)
2. Get a verified USDC deposit address — this becomes your `payTo` wallet address
3. Funds from paid endpoints settle here automatically
4. You can hold USDC or transfer to your bank at any time
5. USDC rewards may be available in some regions

**Pros:** Fiat off-ramp built in, accounting/reporting tools, business-grade compliance, pairs naturally with CDP facilitator.
**Cons:** KYC/KYB verification required, Coinbase takes a small spread on USDC→USD conversion.

### Option B: Self-Custodied Wallet (More control, more responsibility)

Use any EVM wallet — MetaMask, Rainbow, Rabby, or a hardware wallet (Ledger, Trezor). Your wallet address on Base receives USDC directly.

**Pros:** Full custody of funds, no middleman, instant access.
**Cons:** You're responsible for security (seed phrase backup), no built-in fiat off-ramp — you'd need to bridge USDC to an exchange yourself to cash out. Tax tracking is manual.

### Option C: Programmatic Wallet (CDP Wallet API)

If you want the server itself to have a wallet (useful for automated refunds or forwarding):

- Use [Coinbase Developer Platform Wallet API](https://docs.cdp.coinbase.com) to create a programmatic wallet
- MPC-based key management — private keys are never exposed
- Can be managed entirely via API/SDK

**Pros:** No manual key management, good for automated workflows.
**Cons:** Custodied by Coinbase (MPC), adds a dependency.

### Recommendation

Start with **Option A (Coinbase Business)** for the simplest path from USDC revenue to your bank account. You can always add a self-custodied wallet later or run both. The wallet address goes into your `.env` as `WALLET_ADDRESS`.

---

## 2. Coinbase Developer Platform (CDP) Account

Required for production use of the x402 facilitator.

1. Sign up at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Generate a **CDP API Key** — you'll get a `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`
3. These go into your `.env` for the x402 middleware to authenticate with the facilitator

**Free tier:** 1,000 transactions/month. After that, $0.001 per transaction (settled from the payment itself, not from your account).

**What the facilitator does:** Verifies buyer payment signatures and settles USDC on-chain. You never touch blockchain infrastructure directly.

**Testing:** Use Base Sepolia testnet (`eip155:84532`) during development. Get testnet USDC from the [Circle faucet](https://faucet.circle.com). Switch to Base mainnet (`eip155:8453`) for production.

---

## 3. Domain Name

The "clipcast" name has some existing usage (clipcast.ai, clipcast.it, clipcast.app) but none are direct competitors. You'll need to check availability and register your preferred TLD.

**Domains to check:**
- `clipcast.dev` — clean, developer-oriented
- `clipcast.io` — common for API products
- `clipcast.video` — descriptive
- `clipcast.so` — trendy, short

**Registrars:** Cloudflare Registrar (at-cost pricing, good DNS), Namecheap, Google Domains.

You'll also want to set up DNS records pointing to your hosting provider.

---

## 4. Hosting / Deployment

Clipcast runs a Docker container with Bun + Playwright (headless Chromium) + FFmpeg. This rules out serverless platforms and most lightweight PaaS tiers. You need a container service or VPS with at least 2GB RAM.

### Recommended Options (Ranked)

**1. Fly.io** — Best overall for Clipcast

There's a published guide for exactly the Bun + Playwright combo on Fly.io. Docker-native, static IPs included, global multi-region deployment if you ever want low-latency rendering in different geographies. Usage-based pricing.

- Spec: 2 vCPU / 2GB RAM machine
- Cost: ~$15–30/mo
- Pros: Proven Playwright+Bun compatibility, CLI-driven deploys, scales to multiple regions
- Cons: No auto-deploy from Git (requires `fly deploy` from CLI or CI)

**2. Railway** — Fastest developer experience

Deploys in 30–90 seconds, strong Docker support with parallel builds, and a clean dashboard for managing services + env vars. Usage-based pricing. Runs on their own hardware (Railway Metal), not AWS.

- Spec: Pay per CPU/memory usage
- Cost: ~$10–25/mo for a moderate-traffic API
- Pros: Fastest iteration loop, great DX, one-click database provisioning
- Cons: Single-region only (no multi-region), relatively new platform

**3. Hetzner VPS + Coolify** — Best budget option

A Hetzner CX22 gives you 2 vCPU / 4GB RAM for ~€5/month — 4–8x more resources per dollar than managed PaaS. Install Coolify (open-source, self-hosted PaaS) on top for git-push deploys, automatic SSL, and a dashboard.

- Spec: CX22 (2 vCPU, 4GB RAM) or CX32 (4 vCPU, 8GB RAM)
- Cost: ~$5–12/mo
- Pros: Cheapest by far, full control, great for MVP phase when revenue is $0
- Cons: You manage uptime, security, and updates. EU-based (latency for US users, though fine for API)

**4. Render** — Production-polished, less flexible

Autoscaling, health checks, zero-downtime deploys, and predictable instance-based pricing. Docker support works but isn't as flexible as Railway's. Better for steady SaaS workloads than bursty rendering jobs.

- Spec: Starter ($7/mo, 512MB) too small; Standard ($25/mo, 2GB) minimum
- Cost: ~$25–50/mo
- Pros: Mature platform, auto-deploys from Git, Blueprint IaC
- Cons: Instance-based pricing less efficient for variable rendering loads, Starter tier too constrained for Playwright

**5. DigitalOcean** — Reliable fallback

App Platform for managed Docker deploys, or a raw Droplet for self-managed. Solid docs, mature ecosystem, no strong advantage or disadvantage.

- Spec: 2GB Droplet or App Platform Basic
- Cost: ~$12–24/mo
- Pros: Well-documented, predictable, good community
- Cons: No standout feature for this workload

### Docker Image Approach

Regardless of hosting provider, base your Dockerfile on the official Playwright image, install Bun and FFmpeg on top:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.58.2-noble
RUN apt-get update && apt-get install -y unzip curl ffmpeg && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$PATH:/root/.bun/bin
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
CMD ["bun", "run", "src/index.ts"]
```

**Important Docker flags:** Use `--ipc=host` or `--shm-size=2gb` to prevent Chromium OOM crashes.

### Recommendation

Start with **Fly.io** or **Railway** for managed deploys with minimal ops overhead. If you want to minimize costs during MVP, a **Hetzner VPS + Coolify** setup gets you more compute for less money at the cost of self-management.

---

## 5. Object Storage (Video Files)

Videos are stored temporarily (24-hour expiration by default) and served to callers via URL.

| Provider | Service | Free Tier | Cost After | Notes |
|----------|---------|-----------|------------|-------|
| **Cloudflare R2** | S3-compatible | 10GB storage, 1M reads/mo | $0.015/GB storage | No egress fees — best for serving video |
| **AWS S3** | S3 | 5GB (12 months) | $0.023/GB + egress | Standard choice, egress costs add up |
| **Backblaze B2** | S3-compatible | 10GB storage | $0.006/GB storage | Cheap, free egress with Cloudflare CDN |

### Recommendation

**Cloudflare R2** — zero egress fees is a big deal when serving video files. Pairs well with Cloudflare DNS/CDN if you register your domain through Cloudflare.

For Phase 1 (MVP), skip this entirely and serve files from local disk. Add R2 in Phase 3.

---

## 6. Washington State Business Requirements

You're forming PI Innovations, LLC in Washington. Here's what applies to Clipcast as a digital service accepting crypto payments.

### How Tax Jurisdiction Works

**B&O tax follows where the LLC is formed.** Because PI Innovations is a Washington LLC, you owe Washington B&O tax on gross receipts regardless of where your servers are hosted or where your customers are.

**Sales tax follows where your customers are.** Washington (and most states) use "economic nexus" rules — if you exceed a threshold of sales into a state ($100K revenue or 200 transactions in Washington), you may owe that state's sales tax even without physical presence there. This applies state by state.

**Server location doesn't affect tax obligations.** Hosting on Fly.io in Virginia vs Frankfurt doesn't change what you owe. Server location matters for latency and data residency, not tax.

**For Clipcast, the customer location question is largely uncharted.** Your primary buyers are AI agents and developers paying with USDC via x402. There's no mailing address, billing country, or state on the transaction — just a wallet address. How sales tax nexus applies to anonymous crypto-native API micropayments is still murky legally. This is a key question to raise with a CPA early, because the answer shapes whether you need to collect sales tax at all, and from whom.

### Business & Occupation (B&O) Tax

Washington has no income tax but does have B&O tax on **gross receipts** (revenue, not profit).

- **Rate:** 1.5% for Service and Other Activities (for businesses under $1M gross income). As of October 2025, tiered rates apply: 1.5% under $1M, 1.75% for $1M–$5M, 2.1% for $5M+.
- **Digital services** are now subject to retail sales tax and retailing B&O tax as of October 1, 2025 under ESSB 5814. This includes IT services, custom software, and data processing. Whether x402 API video generation falls under "digital automated services" or "IT services" is worth confirming with a tax professional.
- **Registration:** Register with the WA Department of Revenue at [dor.wa.gov](https://dor.wa.gov). File returns monthly, quarterly, or annually based on revenue.
- **Measurement:** Tax is measured by the USD value of USDC received at the time of transaction.

### Sales Tax Considerations

Washington charges sales tax (6.5% state + local) on digital products and certain digital services sold to Washington customers. Since Clipcast customers are primarily AI agents and developers worldwide, most sales will likely be to out-of-state or international buyers — but you'll need to understand nexus rules if you have Washington customers.

### Federal Tax (IRS)

- USDC received as business income is taxable as ordinary income at its USD value when received
- Track every transaction with date, amount, and USD value
- The LLC's income flows through to your personal federal return (single-member LLC)
- IRS Form 1040 Schedule C (or Schedule E if multi-member)
- You must answer "Yes" to the digital assets question on your tax return

### Recommendation

**Consult a CPA familiar with both Washington B&O tax and crypto.** The intersection of digital services, crypto payments, and Washington's new 2025 tax expansions is complex. Budget $500–1,000 for an initial consultation to get your reporting set up correctly from day one.

---

## 7. Summary Checklist

### Before You Write Code

- [ ] **Wallet address** — Create a Coinbase Business account or self-custodied wallet on Base
- [ ] **CDP account** — Sign up at portal.cdp.coinbase.com, generate API keys
- [ ] **Testnet USDC** — Get from Circle faucet for Base Sepolia testing
- [ ] **Domain** — Register clipcast.dev (or preferred TLD)

### Before You Go Live (Production)

- [ ] **Fund wallet with ETH** — Small amount of ETH on Base for gas (facilitator handles most, but good to have)
- [ ] **Switch to mainnet** — Update NETWORK env var to `eip155:8453`
- [ ] **Object storage** — Set up Cloudflare R2 bucket for video files
- [ ] **Hosting** — Deploy Docker container to Fly.io or chosen provider
- [ ] **DNS** — Point domain to hosting, set up SSL
- [ ] **CDN** — Cloudflare in front of R2 for video delivery (free tier is sufficient)

### Business & Legal

- [ ] **LLC formation** — Complete PI Innovations, LLC filing with WA Secretary of State
- [ ] **EIN** — Get from IRS (free, instant online)
- [ ] **WA Business License** — Register with Department of Revenue
- [ ] **B&O tax setup** — Register for B&O filing schedule
- [ ] **Bank account** — Business checking account for the LLC
- [ ] **CPA consultation** — Get tax advice on crypto revenue + WA B&O obligations
- [ ] **Bookkeeping system** — Track USDC received, USD value at time of receipt, conversion to fiat
- [ ] **Terms of Service** — Basic ToS for the API (content ownership, liability, refund policy)
- [ ] **Privacy Policy** — Required if the marketing site collects any data

### Nice to Have

- [ ] **Business insurance** — General liability, errors & omissions (E&O)
- [ ] **Registered agent** — Already exploring this for the LLC
- [ ] **Trademark** — Consider filing if the name takes off
- [ ] **GitHub org** — `github.com/clipcast` or similar for the project
