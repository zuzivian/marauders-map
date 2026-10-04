// Titles as posted on company career sites for the 2025–26 and 2026–27 cycles (checked 2026-10-03).
export interface Role {
  id: string;
  name: string;
  epithet: string;
  definition: string;
  technical: number; // 0–100
  leadsTo: string;
  prepKey: string; // key into prep.json roles
  titles: { company: string; title: string }[];
}

export const roles: Role[] = [
  {
    id: "pm", name: "Product manager", epithet: "the builder", technical: 78,
    definition: "Decides what gets built and why. Writes specs, ranks the roadmap, and ships with engineering and design.",
    leadsTo: "Full-time PM, then senior PM; a common path to GM.",
    prepKey: "Product Manager (incl. TPM)",
    titles: [
      { company: "Amazon", title: "Amazon Leadership Accelerator (ALA) Product Manager" }, { company: "Amazon", title: "Product Manager Technical (PMT) Intern" },
      { company: "Google", title: "MBA Intern (team-matched to PM)" }, { company: "Microsoft", title: "Product Manager: MBA Internship" },
      { company: "Microsoft", title: "Technical Program Manager: MBA" }, { company: "Adobe", title: "MBA Intern – Product Manager" },
      { company: "Intuit", title: "Product Manager Intern" }, { company: "Nvidia", title: "Product Management MBA Intern" },
    ],
  },
  {
    id: "pmm", name: "Product marketing", epithet: "the storyteller", technical: 35,
    definition: "Decides who a product is for and how it's sold. Owns positioning, launches, pricing input, and sales enablement.",
    leadsTo: "Full-time PMM, marketing leadership, sometimes GM.",
    prepKey: "Product Marketing Manager",
    titles: [
      { company: "Meta", title: "Product Marketing Manager Intern, MBA" }, { company: "Adobe", title: "MBA Intern – Product Marketing Manager" },
      { company: "Amazon", title: "MBA Marketing Manager (MM) Internship" }, { company: "Microsoft", title: "Marketing: MBA Internship" },
      { company: "Intuit", title: "MBA Product Marketing Intern" }, { company: "Nvidia", title: "Product Marketing MBA Intern" },
      { company: "Apple", title: "MBA Internships (Marketing)" },
    ],
  },
  {
    id: "ops", name: "Strategy and BizOps", epithet: "the internal consultant", technical: 48,
    definition: "Takes on the messiest problems in the business: planning, metrics, pricing, and one-off strategy projects.",
    leadsTo: "Strategy lead, chief of staff, or a GM track.",
    prepKey: "Strategy & BizOps",
    titles: [
      { company: "Google", title: "MBA Intern (team-matched to BizOps / Strategy & Ops)" }, { company: "Uber", title: "Strategy & Planning MBA Intern" },
      { company: "Intuit", title: "MBA Product Strategy & BizOps Intern" }, { company: "Intuit", title: "MBA Corp Strategy & Dev Intern" },
      { company: "Amazon", title: "MBA Leadership Development Program (MLDP)" }, { company: "Airbnb", title: "Business Growth Intern, Experiences (MBA)" },
      { company: "Airbnb", title: "Strategic Finance & Analytics Intern (MBA)" }, { company: "Apple", title: "MBA Internships (Product Operations)" },
      { company: "Adobe", title: "Strategy & Ops (team roles)" },
    ],
  },
  {
    id: "bd", name: "Partnerships, BD, and deals", epithet: "the dealmaker", technical: 18,
    definition: "Finds, negotiates, and manages the deals a business depends on: partners, strategic customers, and acquisitions.",
    leadsTo: "BD leadership or corporate development.",
    prepKey: "Partnerships/BD",
    titles: [
      { company: "Microsoft", title: "Business Development Specialist: MBA" }, { company: "Salesforce", title: "MBA Business Value & Strategic Selling Consultant" },
      { company: "Nvidia", title: "Corp Dev MBA Intern" }, { company: "Adobe", title: "Corp Dev (team roles)" },
    ],
  },
];
