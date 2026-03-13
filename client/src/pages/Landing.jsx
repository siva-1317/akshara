import { Link } from "react-router-dom";

const features = [
  {
    number: "01",
    title: "AI Test Generation",
    description:
      "Generate custom exams instantly using AI with topic and difficulty selection."
  },
  {
    number: "02",
    title: "Adaptive Insights",
    description: "Track scores, weak topics, and get smart suggestions from AI."
  },
  {
    number: "03",
    title: "Advanced Exam Modes",
    description: "Use total timer, per-question timer, and restricted navigation."
  }
];

const whyAkshara = [
  ["AI Generated Tests", "Smart question creation"],
  ["Adaptive Difficulty", "Adjusts to your level"],
  ["Weakness Detection", "Finds your mistakes"],
  ["Smart Suggestions", "Recommends next test"],
  ["Real Exam Simulation", "Timer & no-return modes"],
  ["Performance Analytics", "Track improvement"]
];

const examModes = [
  {
    title: "Total Timer Mode",
    text: "Practice full-length tests with one unified countdown for an exam-style experience."
  },
  {
    title: "Per Question Timer",
    text: "Stay sharp with focused timing on each question and consistent pacing."
  },
  {
    title: "No Return Mode",
    text: "Simulate strict assessments where you must commit before moving ahead."
  },
  {
    title: "Practice Mode",
    text: "Review-friendly flow for skill building, explanation reading, and steady improvement."
  }
];

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <div className="landing-orb landing-orb-three" />

      <div className="page-shell">
        <div className="container">
          <section className="hero-panel hero-glass mb-5">
            <div className="row align-items-center g-4 g-xl-5">
              <div className="col-lg-7">
                <span className="hero-chip mb-3">AI Powered Test Platform</span>
                <p className="hero-tagline mb-3">AI Powered Test & Learning Portal</p>
                <h1 className="hero-title mb-3">
                  AKSHARA makes learning smarter with AI-generated exams
                </h1>
                <p className="hero-description mb-4">
                  Create AI-based tests, track performance, detect weak topics, and get smart
                  suggestions.
                </p>
                <div className="d-flex flex-wrap gap-3">
                  <Link className="btn btn-ak-primary btn-lg px-4" to="/login">
                    Sign in with Google
                  </Link>
                  <Link className="btn btn-outline-ak btn-lg px-4" to="/dashboard">
                    Open Dashboard
                  </Link>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="glass-panel info-panel h-100">
                  <div className="d-flex justify-content-between align-items-start mb-4">
                    <div>
                      <p className="panel-kicker mb-2">Portal Overview</p>
                      <h3 className="fw-bold mb-0">Why AKSHARA</h3>
                    </div>
                    <span className="mini-badge">AI</span>
                  </div>

                  <div className="d-grid gap-3">
                    {whyAkshara.map(([label, value]) => (
                      <div className="glass-list-item" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <div className="section-heading text-center mb-4">
              <p className="section-kicker mb-2">Feature Highlights</p>
              <h2 className="section-display">A modern AI-first test experience</h2>
            </div>

            <div className="row g-4">
              {features.map((feature) => (
                <div className="col-md-6 col-xl-4" key={feature.title}>
                  <div className="glass-panel feature-panel h-100">
                    <span className="feature-number">{feature.number}</span>
                    <h4 className="fw-bold mb-3">{feature.title}</h4>
                    <p className="text-muted mb-0">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-5">
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-5">
                <div className="glass-panel why-panel h-100">
                  <p className="section-kicker mb-2">Why Akshara</p>
                  <h2 className="section-display text-start mb-3">
                    Built to turn every test into a smarter learning loop
                  </h2>
                  <p className="text-muted mb-0">
                    AKSHARA combines AI generation, instant evaluation, analytics, and secure
                    cloud access into one focused learning workspace.
                  </p>
                </div>
              </div>

              <div className="col-lg-7">
                <div className="row g-4">
                  <div className="col-sm-6">
                    <div className="glass-panel stat-panel h-100">
                      <h5 className="fw-bold">Personalized Practice</h5>
                      <p className="text-muted mb-0">
                        Shape every test around your topic, level, and exam pattern.
                      </p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="glass-panel stat-panel h-100">
                      <h5 className="fw-bold">Instant Insights</h5>
                      <p className="text-muted mb-0">
                        See weak areas quickly and act on AI-guided next steps.
                      </p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="glass-panel stat-panel h-100">
                      <h5 className="fw-bold">Exam Readiness</h5>
                      <p className="text-muted mb-0">
                        Practice under timed conditions that feel close to real assessments.
                      </p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="glass-panel stat-panel h-100">
                      <h5 className="fw-bold">Cloud-Native Tracking</h5>
                      <p className="text-muted mb-0">
                        Store performance history safely and revisit every result anytime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <div className="section-heading text-center mb-4">
              <p className="section-kicker mb-2">Exam Modes</p>
              <h2 className="section-display">Choose the testing flow that fits your goal</h2>
            </div>

            <div className="row g-4">
              {examModes.map((mode) => (
                <div className="col-md-6 col-xl-3" key={mode.title}>
                  <div className="glass-panel mode-panel h-100">
                    <h5 className="fw-bold mb-3">{mode.title}</h5>
                    <p className="text-muted mb-0">{mode.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="glass-panel landing-footer">
            <div className="row align-items-center g-3">
              <div className="col-md-6">
                <h4 className="fw-bold mb-1">AKSHARA</h4>
                <p className="mb-0 text-muted">AI Test Portal</p>
              </div>
              <div className="col-md-6 text-md-end">
                <p className="mb-0 text-muted">Made with React + Gemini + Supabase</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
