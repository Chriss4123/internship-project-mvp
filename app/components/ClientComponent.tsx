"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { FIELDS_AND_ROLES, Field, Role, getRolesForField, getRoleLabel } from '@/lib/constants';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SA_CITIES = [
  { value: "", label: "-- Select a City --" },
  { value: "Johannesburg", label: "Johannesburg" },
  { value: "Cape Town", label: "Cape Town" },
  { value: "Durban", label: "Durban" },
  { value: "Pretoria", label: "Pretoria" },
  { value: "Port Elizabeth", label: "Port Elizabeth" },
  { value: "Bloemfontein", label: "Bloemfontein" },
];

interface Job {
  job_id: string;
  employer_name?: string;
  job_title?: string;
  job_description?: string;
  job_apply_link?: string;
  job_city?: string;
  job_country?: string;
}

interface ProjectIdea {
  projectTitle: string;
  projectDescription: string;
  projectAppeal: string;
  keySkillsDemonstrated: string[];
  projectChecklist: string[];
  error?: string;
  rawResponse?: string;
  groundingHtml?: string;
  webSearchQueries?: string[];
  skillsRequired: string;
  markdownReport?: string;
}

export default function ClientComponent() {
  const [selectedField, setSelectedField] = useState<string>("");
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [location, setLocation] = useState<string>("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  const [projectIdea, setProjectIdea] = useState<ProjectIdea | null>(null);

  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(false);
  const [isRenderingReport, setIsRenderingReport] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const [skillsTyped, setSkillsTyped] = useState("");
  const [reportTyped, setReportTyped] = useState("");
  const [showMappingLine, setShowMappingLine] = useState(false);

  useEffect(() => {
    if (projectIdea?.groundingHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument ?? iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(projectIdea.groundingHtml);
        doc.close();
      }
    }
  }, [projectIdea?.groundingHtml]);

  useEffect(() => {
    if (selectedField) {
      setAvailableRoles(getRolesForField(selectedField));
      setSelectedRoles([]);
    } else {
      setAvailableRoles([]);
      setSelectedRoles([]);
    }
  }, [selectedField]);

  useEffect(() => {
    const handleClickOutside = (evt: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(evt.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedField(e.target.value);
    setJobs([]);
    setProjectIdea(null);
    setError(null);
  };

  const toggleRoleSelection = (roleValue: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleValue)
        ? prev.filter(r => r !== roleValue)
        : [...prev, roleValue]
    );
  };

  const handleFindJobs = async () => {
    if (!selectedField || selectedRoles.length === 0 || !location) {
      setError("Please select a field, at least one role, and enter a location.");
      return;
    }
    setError(null);
    setIsLoadingJobs(true);
    setJobs([]);
    setProjectIdea(null);

    try {
      const response = await axios.post('/api/search-jobs', {
        field: selectedField,
        roles: selectedRoles.map(r => getRoleLabel(r)),
        location,
      });
      setJobs(response.data.jobs || []);
      if (!response.data.jobs || response.data.jobs.length === 0) {
        setError("No jobs found for your criteria. Try broadening your search.");
      }
    } catch (err: any) {
      console.error("Error fetching jobs:", err);
      setError(err.response?.data?.error || "Failed to fetch jobs.");
      setJobs([]);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleJobSelectionChange = (jobId: string) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const selectedJobDetails = useMemo(() => {
    return jobs
      .filter(job => selectedJobIds.includes(job.job_id))
      .map(job => ({
        title: job.job_title || "N/A",
        description: job.job_description || "N/A",
        company: job.employer_name || "N/A"
      }));
  }, [jobs, selectedJobIds]);

  const handleGenerateProject = async () => {
    if (selectedJobIds.length === 0) {
      setError("Please select at least one job you are interested in.");
      return;
    }
    setError(null);
    setIsLoadingProject(true);
    setProjectIdea(null);
    setSkillsTyped("");
    setReportTyped("");

    try {
      const response = await axios.post('/api/generate-project', {
        field: FIELDS_AND_ROLES.find(f => f.value === selectedField)?.label || selectedField,
        roles: selectedRoles.map(r => getRoleLabel(r)),
        location,
        selectedJobDetails: selectedJobDetails,
      });

      if (response.data.error && response.data.rawResponse) {
        setProjectIdea({
          projectTitle: "Error from AI",
          projectDescription: `The AI couldn't generate a structured project idea. ${response.data.error}`,
          skillsRequired: "N/A",
          projectAppeal: "Please check the raw response below for details or try again.",
          keySkillsDemonstrated: [],
          projectChecklist: ["Review the raw AI output if available."],
          error: response.data.error,
          rawResponse: response.data.rawResponse
        });
      } else {
        setProjectIdea(response.data);
      }
      setIsRenderingReport(true);
    } catch (err: any) {
      console.error("Error generating project:", err);
      setError(err.response?.data?.error || "Failed to generate project idea.");
      setProjectIdea(null);
    } finally {
      setIsLoadingProject(false);
    }
  };

  useEffect(() => {
    if (!projectIdea) return;

    setShowMappingLine(false);
    const mappingTimer = setTimeout(() => setShowMappingLine(true), 1000);

    const skillsStr = projectIdea.skillsRequired || "";

    const reportStr = (() => {
      if (projectIdea.error) {
        return `# ${projectIdea.projectTitle}\n\n${projectIdea.projectDescription}`;
      }
      if (projectIdea.markdownReport) return projectIdea.markdownReport;

      const listSkills = projectIdea.keySkillsDemonstrated
        .map(s => `- ${s}`)
        .join('\n');
      const checklist = projectIdea.projectChecklist
        .map(c => `- [ ] ${c}`)
        .join('\n');

      return `# 🚀 ${projectIdea.projectTitle}\n\n` +
        `${projectIdea.projectDescription}\n\n` +
        `## Why this project will impress\n${projectIdea.projectAppeal}\n\n` +
        `### Key skills\n${listSkills}\n\n` +
        `### Project checklist\n${checklist}`;
    })();
    let skillsIdx = 0, reportIdx = 0;

    const startTyping = () => {
      const skillsInterval = setInterval(() => {
        skillsIdx++;
        setSkillsTyped(skillsStr.slice(0, skillsIdx));
        if (skillsIdx >= skillsStr.length) {
          clearInterval(skillsInterval);
          const reportInterval = setInterval(() => {
            reportIdx++;
            setReportTyped(reportStr.slice(0, reportIdx));
            if (reportIdx >= reportStr.length) {
              clearInterval(reportInterval);
              setIsRenderingReport(false);
            }
          }, 10);
        }
      }, 15);
    };

    const typingDelay = setTimeout(startTyping, 1000);
    return () => {
      clearTimeout(mappingTimer);
      clearTimeout(typingDelay);
    };
  }, [projectIdea]);

  const handleDownloadMarkdown = () => {
    if (!projectIdea || !reportTyped) return;
    
    const filename = projectIdea.projectTitle 
      ? `${projectIdea.projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
      : 'project_idea.md';
    
    const blob = new Blob([reportTyped], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-12 px-6 space-y-10">
      <h1 className="text-4xl font-bold text-center text-indigo-700 mb-2 tracking-tight">
        Graduate Internship Project Suggester
      </h1>
      <p className="text-center text-gray-600 max-w-2xl mx-auto">
        Find relevant internship opportunities and generate impressive project ideas that will boost your CV and impress employers.
      </p>
      
      <section className="p-8 bg-white shadow-2xl rounded-xl space-y-6 border border-indigo-50 transition-all hover:shadow-indigo-100">
        <h2 className="text-2xl font-semibold text-indigo-800 border-b border-indigo-100 pb-3">
          1. Your Preferences
        </h2>
        <div className="space-y-2">
          <label htmlFor="field" className="block text-sm font-medium text-gray-700">General Field:</label>
          <select 
            id="field" 
            value={selectedField} 
            onChange={handleFieldChange} 
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          >
            <option value="">-- Select a Field --</option>
            {FIELDS_AND_ROLES.map(field => (
              <option key={field.value} value={field.value}>{field.label}</option>
            ))}
          </select>
        </div>

        {selectedField && (
          <div className="multi-select-container space-y-2" ref={roleDropdownRef}>
            <label className="block text-sm font-medium text-gray-700">Specific Role(s):</label>
            <div
              className="w-full p-3 min-h-[3rem] border border-gray-300 rounded-lg shadow-sm bg-white flex flex-wrap gap-2 cursor-pointer hover:border-indigo-400 transition-colors"
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            >
              {selectedRoles.length === 0 && <span className="text-gray-500">-- Select Role(s) --</span>}
              {selectedRoles.map(roleValue => (
                <span key={roleValue} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                  {getRoleLabel(roleValue)}
                  <button
                    type="button"
                    className="ml-2 text-indigo-500 hover:text-indigo-800 focus:outline-none"
                    onClick={(e) => { e.stopPropagation(); toggleRoleSelection(roleValue); }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {isRoleDropdownOpen && (
              <div className="absolute mt-1 w-full max-w-[calc(100%-3rem)] bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {availableRoles.map(role => (
                  <div
                    key={role.value}
                    onClick={() => toggleRoleSelection(role.value)}
                    className={`p-3 hover:bg-indigo-50 cursor-pointer transition-colors ${
                      selectedRoles.includes(role.value) ? 'bg-indigo-100' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-4 h-4 mr-3 rounded border flex items-center justify-center ${
                        selectedRoles.includes(role.value) 
                          ? 'border-indigo-600 bg-indigo-600' 
                          : 'border-gray-300'
                      }`}>
                        {selectedRoles.includes(role.value) && <span className="text-white text-xs">✓</span>}
                      </div>
                      {role.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">Preferred South African City:</label>
          <select
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          >
            {SA_CITIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleFindJobs} 
          disabled={isLoadingJobs || !selectedField || selectedRoles.length === 0 || !location} 
          className="w-full py-3 px-6 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none"
        >
          {isLoadingJobs ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching Jobs...
            </span>
          ) : "Find Internship Opportunities"}
        </button>
      </section>

      {error && (
        <div className="animate-fadeIn transition-all">
          <p className="text-red-500 bg-red-50 border border-red-200 p-4 rounded-lg text-center shadow-sm">
            {error}
          </p>
        </div>
      )}

      {jobs.length > 0 && (
        <section className="p-8 bg-white shadow-2xl rounded-xl space-y-6 border border-indigo-50 transition-all hover:shadow-indigo-100">
          <h2 className="text-2xl font-semibold text-indigo-800 border-b border-indigo-100 pb-3">
            2. Relevant Internships Found
          </h2>
          <p className="text-gray-600">
            Select the jobs that interest you the most to generate a tailored project idea. 
            <span className="ml-1 text-indigo-600 font-medium">Select up to 5 for best results.</span>
          </p>
          <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-gray-100">
            {jobs.map(job => (
              <div 
                key={job.job_id} 
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all hover:border-indigo-200 bg-white"
              >
                <div className="flex items-start space-x-4">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      id={`job-${job.job_id}`}
                      checked={selectedJobIds.includes(job.job_id)}
                      onChange={() => handleJobSelectionChange(job.job_id)}
                      className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <label htmlFor={`job-${job.job_id}`} className="flex-1 cursor-pointer">
                    <h3 className="font-semibold text-indigo-700 text-lg">{job.job_title || "N/A"}</h3>
                    <p className="text-sm text-gray-600 mt-1 flex items-center">
                      <span className="font-medium">{job.employer_name || "N/A"}</span>
                      <span className="mx-2">•</span>
                      <span>{job.job_city}, {job.job_country}</span>
                    </p>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {job.job_description ? job.job_description.substring(0, 150) + "..." : "No description available."}
                    </p>
                    {job.job_apply_link && (
                      <a 
                        href={job.job_apply_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Original Listing
                        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={handleGenerateProject} 
            disabled={isLoadingProject || isRenderingReport || selectedJobIds.length === 0} 
            className="w-full py-3 px-6 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none"
          >
            {(isLoadingProject || isRenderingReport) ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Project Idea...
              </span>
            ) : "Suggest CV-Boosting Project"}
          </button>
        </section>
      )}

      {(isLoadingProject || projectIdea) && (
        <section className="p-8 bg-white shadow-2xl rounded-xl border border-indigo-50 transition-all hover:shadow-indigo-100">
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="ml-4 text-lg text-gray-700 font-medium">
                Researching these companies
                {(!projectIdea) ? (
                  <span className="ml-3 inline-block h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="ml-3 text-green-600 font-bold">✓</span>
                )}
              </p>
            </div>

            {showMappingLine && (
              <>
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="ml-4 text-lg text-gray-700 font-medium">
                    Mapping out skills these companies value...
                    {(skillsTyped.length < (projectIdea?.skillsRequired?.length || 0)) ? (
                      <span className="ml-3 inline-block h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="ml-3 text-green-600 font-bold">✓</span>
                    )}
                  </p>
                </div>

                {skillsTyped && (
                  <div className="ml-12 bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
                    <p className="text-gray-700 whitespace-pre-line font-light">{skillsTyped}</p>
                  </div>
                )}
              </>
            )}

            {reportTyped && (
              <div className="ml-12 mt-6 bg-white p-6 rounded-lg border border-gray-200 shadow-sm prose prose-indigo max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-indigo-800 border-b pb-2 mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-indigo-700 mt-6 mb-3" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-medium text-indigo-600 mt-4 mb-2" {...props} />,
                    ul: ({node, ...props}) => <ul className="space-y-1 my-3" {...props} />,
                    li: ({node, ...props}) => <li className="text-gray-700" {...props} />,
                    p: ({node, ...props}) => <p className="text-gray-700 my-3" {...props} />,
                    input: (props) => (
                      <input {...props} className="mr-2 h-4 w-4 accent-indigo-600 rounded" disabled />
                    ),
                  }}
                >
                  {reportTyped}
                </ReactMarkdown>
                
                {reportTyped.length === (projectIdea?.markdownReport?.length || projectIdea?.error ? 
                  `# ${projectIdea?.projectTitle}\n\n${projectIdea?.projectDescription}`.length : 
                  `# 🚀 ${projectIdea?.projectTitle}\n\n${projectIdea?.projectDescription}\n\n## Why this project will impress\n${projectIdea?.projectAppeal}\n\n### Key skills\n${projectIdea?.keySkillsDemonstrated.map(s => `- ${s}`).join('\n')}\n\n### Project checklist\n${projectIdea?.projectChecklist.map(c => `- [ ] ${c}`).join('\n')}`.length) && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-2 py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Project as Markdown
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="text-center text-gray-500 text-sm mt-10 pb-10">
        Made with ❤️ for South African graduates
      </footer>
    </div>
  );
}