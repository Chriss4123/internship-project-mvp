export interface Role {
  value: string;
  label: string;
}

export interface Field {
  value: string;
  label: string;
  roles: Role[];
}

export const FIELDS_AND_ROLES: Field[] = [
  {
    value: "tech",
    label: "Technology",
    roles: [
      { value: "software_engineer", label: "Software Engineer" },
      { value: "data_scientist", label: "Data Scientist" },
      { value: "data_analyst", label: "Data Analyst" },
      { value: "product_manager", label: "Product Manager (Tech)" },
      { value: "ux_ui_designer", label: "UX/UI Designer" },
      { value: "devops_engineer", label: "DevOps Engineer" },
      { value: "cybersecurity_analyst", label: "Cybersecurity Analyst" },
      { value: "machine_learning_engineer", label: "Machine Learning Engineer"},
    ],
  },
  {
    value: "finance",
    label: "Finance",
    roles: [
      { value: "financial_analyst", label: "Financial Analyst" },
      { value: "investment_banking_analyst", label: "Investment Banking Analyst" },
      { value: "accountant", label: "Accountant" },
      { value: "risk_manager", label: "Risk Manager" },
      { value: "quantitative_analyst", label: "Quantitative Analyst (Quant)" },
      { value: "portfolio_manager", label: "Portfolio Manager (Assistant)"}
    ],
  },
  {
    value: "marketing",
    label: "Marketing",
    roles: [
        { value: "digital_marketing_specialist", label: "Digital Marketing Specialist"},
        { value: "social_media_manager", label: "Social Media Manager"},
        { value: "content_creator", label: "Content Creator/Writer"},
        { value: "seo_specialist", label: "SEO Specialist"},
        { value: "marketing_analyst", label: "Marketing Analyst"},
    ]
  },
  {
    value: "healthcare",
    label: "Healthcare",
    roles: [
        { value: "research_assistant_bio", label: "Research Assistant (Biology/Medical)"},
        { value: "healthcare_administrator_intern", label: "Healthcare Administrator Intern"},
        { value: "public_health_intern", label: "Public Health Intern"},
        { value: "clinical_data_analyst", label: "Clinical Data Analyst (Entry)"}
    ]
  }
];

export const getRolesForField = (fieldValue: string): Role[] => {
  const field = FIELDS_AND_ROLES.find((f) => f.value === fieldValue);
  return field ? field.roles : [];
};

export const getRoleLabel = (roleValue: string): string => {
    for (const field of FIELDS_AND_ROLES) {
        const role = field.roles.find(r => r.value === roleValue);
        if (role) return role.label;
    }
    return roleValue;
}