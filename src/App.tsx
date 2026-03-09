import "./index.css";

export function App() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          <span className="text-[#e94560]">Clip</span>cast
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-8">
          Turn structured data into animated portrait videos with a single API call. Pay per request
          with USDC on Base.
        </p>
        <div className="flex gap-4">
          <a
            href="/api/health"
            className="px-6 py-3 bg-[#e94560] hover:bg-[#c73e54] rounded-lg font-semibold transition-colors"
          >
            Check API Status
          </a>
          <a
            href="https://github.com/paulingalls/clipcast"
            className="px-6 py-3 border border-gray-600 hover:border-gray-400 rounded-lg font-semibold transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Step
            number="1"
            title="Send phrases"
            description="POST an array of phrases, optional images, colors, and timing to /api/generate."
          />
          <Step
            number="2"
            title="We render"
            description="Headless Chromium animates your content. FFmpeg encodes it to MP4 in real time."
          />
          <Step
            number="3"
            title="Get video"
            description="Receive a URL to your finished video. Portrait, landscape, or square."
          />
        </div>

        {/* Example */}
        <div className="mt-16 bg-[#16213e] rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-400 mb-4">Example request</h3>
          <pre className="text-sm text-gray-300 leading-relaxed">
            {`curl -X POST http://localhost:3000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "phrases": ["Hello World", "Welcome to Clipcast"],
    "template": "slide-fade",
    "options": {
      "duration": 5,
      "aspectRatio": "9:16",
      "colorScheme": {
        "background": "#1a1a2e",
        "text": "#ffffff",
        "accent": "#e94560"
      }
    }
  }'`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-[#e94560] flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
