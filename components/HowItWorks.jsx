const steps = [
  {
    number: "01",
    title: "Connect your site",
    description: "Add your website URL and we'll start analyzing your SEO health immediately.",
  },
  {
    number: "02",
    title: "Get insights",
    description: "Our AI scans your pages, identifies issues, and prioritizes what to fix first.",
  },
  {
    number: "03",
    title: "Implement fixes",
    description: "Follow our step-by-step recommendations. No technical expertise required.",
  },
  {
    number: "04",
    title: "Watch rankings climb",
    description: "Track your progress as your organic traffic grows week over week.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="pt-20">
      <div className="section-secondary py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes, not hours or days. SimplSEO does the heavy lifting so you don't have to.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <span className="text-7xl font-bold text-primary">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold text-foreground mt-4 mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
};

export default HowItWorks;

