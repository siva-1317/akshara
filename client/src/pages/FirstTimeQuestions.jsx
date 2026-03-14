import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboarding, submitOnboarding } from "../api";
import Card from "../components/Card";
import CustomSelect from "../components/CustomSelect";
import { useToast } from "../components/ToastProvider";

const optionList = (items) => items.map((item) => ({ value: item, label: item }));

const STATUS_OPTIONS = optionList(["Student", "Graduate", "Working Professional", "Other"]);
const STUDENT_YEAR_OPTIONS = optionList(["1st year", "2nd year", "3rd year", "4th year", "Completed"]);
const DEPT_OPTIONS = optionList(["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "Other"]);
const PURPOSE_OPTIONS = optionList([
  "Placement preparation",
  "Semester exams",
  "Competitive exams",
  "Interview preparation",
  "Practice tests",
  "Learning new subjects"
]);
const SUBJECT_OPTIONS = [
  "Aptitude",
  "Programming",
  "DSA",
  "OS",
  "DBMS",
  "Networking",
  "Maths",
  "Physics",
  "Custom topic"
];
const LEVEL_OPTIONS = optionList(["Beginner", "Intermediate", "Advanced"]);
const DIFFICULTY_OPTIONS = optionList(["Easy", "Medium", "Hard", "Mixed"]);
const TEST_STYLE_OPTIONS = optionList(["Short tests", "Long tests", "Timed tests", "Practice mode", "Mixed"]);
const QUESTIONS_PER_TEST_OPTIONS = optionList(["5", "10", "20", "30", "50"]);
const TIME_PER_TEST_OPTIONS = optionList(["5 minutes", "10 minutes", "30 minutes", "1 hour"]);
const YES_NO_OPTIONS = optionList(["Yes", "No"]);
const FOCUS_OPTIONS = optionList(["Aptitude", "Coding", "Core subjects", "Interview questions", "All"]);
const FREQUENCY_OPTIONS = optionList(["Daily", "Weekly", "Sometimes"]);

export default function FirstTimeQuestions() {
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  const [form, setForm] = useState({
    currentStatus: "",
    studentYear: "",
    department: "",
    purpose: "",
    subjectsToPractice: [],
    customTopic: "",
    difficultSubject: "",
    strongSubject: "",
    currentLevel: "Beginner",
    preferredDifficulty: "Mixed",
    testStyle: "Mixed",
    questionsPerTest: "10",
    timePerTest: "10 minutes",
    preparingForPlacement: "Yes",
    focusArea: "All",
    usageFrequency: "Daily",
    mainGoal: "",
    specificTopic: ""
  });

  const subjectSuggestions = useMemo(() => {
    const base = SUBJECT_OPTIONS.filter((item) => item !== "Custom topic");
    const extra = form.customTopic.trim() ? [form.customTopic.trim()] : [];
    return [...new Set([...base, ...extra])];
  }, [form.customTopic]);

  useEffect(() => {
    const guard = async () => {
      try {
        const { data } = await getOnboarding();
        if (data?.completed) {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // ignore
      }
    };

    guard();
  }, [navigate]);

  const toggleSubject = (subject) => {
    setForm((current) => {
      const existing = new Set(current.subjectsToPractice || []);
      if (existing.has(subject)) {
        existing.delete(subject);
      } else {
        existing.add(subject);
      }
      return {
        ...current,
        subjectsToPractice: Array.from(existing)
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.currentStatus) {
      setError("Please select what you are currently.");
      return;
    }

    if (form.currentStatus === "Student" && !form.studentYear) {
      setError("Please select your student year.");
      return;
    }

    if (!form.department) {
      setError("Please select your department / field.");
      return;
    }

    if (!form.purpose) {
      setError("Please select why you are using this app.");
      return;
    }

    if (!form.subjectsToPractice?.length) {
      setError("Please select at least one subject you want to practice.");
      return;
    }

    const answers = {
      ...form,
      customTopic: form.subjectsToPractice.includes("Custom topic") ? form.customTopic.trim() : ""
    };

    try {
      setSaving(true);
      const { data } = await submitOnboarding({ answers });
      if (data?.onboarding?.ai_result) {
        localStorage.setItem("aksharaPersonalization", JSON.stringify(data.onboarding.ai_result));
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save your answers.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-8">
            <Card
              title="Tell us about you"
              subtitle="Answer a few questions so we can personalize your tests and suggestions."
            >
              <form onSubmit={handleSubmit} className="d-grid gap-4">
                <div>
                  <label className="form-label">1. What are you currently?</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={form.currentStatus}
                      options={STATUS_OPTIONS}
                      placeholder="Select"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          currentStatus: event.target.value,
                          studentYear: event.target.value === "Student" ? current.studentYear : ""
                        }))
                      }
                    />
                  </div>
                </div>

                {form.currentStatus === "Student" ? (
                  <div>
                    <label className="form-label">2. If student, which year?</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.studentYear}
                        options={STUDENT_YEAR_OPTIONS}
                        placeholder="Select year"
                        onChange={(event) =>
                          setForm((current) => ({ ...current, studentYear: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="form-label">3. Department / Field</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={form.department}
                      options={DEPT_OPTIONS}
                      placeholder="Select department"
                      onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">4. Why are you using this app?</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={form.purpose}
                      options={PURPOSE_OPTIONS}
                      placeholder="Select reason"
                      onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">5. Which subjects do you want to practice?</label>
                  <div className="subtopic-chip-row">
                    {SUBJECT_OPTIONS.map((subject) => (
                      <button
                        type="button"
                        key={subject}
                        className={`subtopic-chip ${form.subjectsToPractice.includes(subject) ? "active" : ""}`}
                        onClick={() => toggleSubject(subject)}
                      >
                        {subject}
                      </button>
                    ))}
                  </div>

                  {form.subjectsToPractice.includes("Custom topic") ? (
                    <div className="field-shell">
                      <input
                        className="form-control create-input"
                        placeholder="Enter your custom topic"
                        value={form.customTopic}
                        onChange={(event) => setForm((current) => ({ ...current, customTopic: event.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label">6. Which subject is difficult for you?</label>
                    <div className="field-shell">
                      <input
                        className="form-control create-input"
                        list="subject-suggestions"
                        placeholder="Type or pick a subject"
                        value={form.difficultSubject}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, difficultSubject: event.target.value }))
                        }
                      />
                      <datalist id="subject-suggestions">
                        {subjectSuggestions.map((item) => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">7. Which subject are you strong in?</label>
                    <div className="field-shell">
                      <input
                        className="form-control create-input"
                        list="subject-suggestions"
                        placeholder="Type or pick a subject"
                        value={form.strongSubject}
                        onChange={(event) => setForm((current) => ({ ...current, strongSubject: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label">8. Your current level</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.currentLevel}
                        options={LEVEL_OPTIONS}
                        onChange={(event) => setForm((current) => ({ ...current, currentLevel: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">9. Preferred difficulty</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.preferredDifficulty}
                        options={DIFFICULTY_OPTIONS}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, preferredDifficulty: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label">10. How do you want tests?</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={form.testStyle}
                      options={TEST_STYLE_OPTIONS}
                      onChange={(event) => setForm((current) => ({ ...current, testStyle: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label">11. Questions per test</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.questionsPerTest}
                        options={QUESTIONS_PER_TEST_OPTIONS}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, questionsPerTest: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">12. Time per test</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.timePerTest}
                        options={TIME_PER_TEST_OPTIONS}
                        onChange={(event) => setForm((current) => ({ ...current, timePerTest: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label">13. Are you preparing for placement?</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.preparingForPlacement}
                        options={YES_NO_OPTIONS}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, preparingForPlacement: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">14. Focus area</label>
                    <div className="field-shell">
                      <CustomSelect
                        className="create-select"
                        value={form.focusArea}
                        options={FOCUS_OPTIONS}
                        onChange={(event) => setForm((current) => ({ ...current, focusArea: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label">15. How often will you use the app?</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={form.usageFrequency}
                      options={FREQUENCY_OPTIONS}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, usageFrequency: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">16. What is your main goal?</label>
                  <div className="field-shell">
                    <input
                      className="form-control create-input"
                      value={form.mainGoal}
                      onChange={(event) => setForm((current) => ({ ...current, mainGoal: event.target.value }))}
                      placeholder="e.g. Crack placement, Improve coding, Learn aptitude"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">17. Any specific topic you want?</label>
                  <div className="field-shell">
                    <textarea
                      className="form-control create-input"
                      rows="3"
                      value={form.specificTopic}
                      onChange={(event) => setForm((current) => ({ ...current, specificTopic: event.target.value }))}
                      placeholder="Mention topics or chapters you want to focus on"
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end">
                  <button className="btn btn-ak-primary px-4" disabled={saving}>
                    {saving ? "Saving..." : "Submit & Continue"}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
