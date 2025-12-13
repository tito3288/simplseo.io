// app/home/_components/SeoSchemas.jsx

export default function SeoSchemas() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Why is SimplSEO free right now?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text":
            "SimplSEO is in early access. We're offering it for free while we learn from real small business owners. In return, we ask users to share feedback so we can build the right features before charging."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need SEO experience to use this?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text":
            "No. SimplSEO is built for business owners, not SEO experts. Everything is explained in plain English with clear guidance on what to focus on first."
        }
      },
      {
        "@type": "Question",
        "name": "How does this compare to hiring an SEO freelancer or agency?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text":
            "Hiring SEO freelancers or agencies often costs $1,000–$2,500 per month. SimplSEO provides clarity on what's holding your site back without long contracts or retainers, so you can decide what to fix and when."
        }
      },
      {
        "@type": "Question",
        "name": "How is this different from running Google Ads?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text":
            "Google Ads stop delivering traffic when you stop paying. SEO improves how Google understands your website so customers can find you organically over time. SimplSEO focuses on long-term visibility."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to see results?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text":
            "SEO takes time, but SimplSEO provides immediate clarity. Most users understand what's holding their site back within minutes of connecting their website."
        }
      }
    ]
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SimplSEO",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description":
      "SimplSEO is SEO software that helps small business owners understand why their website isn't performing on Google and what to fix first — in plain English.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
    </>
  );
}

