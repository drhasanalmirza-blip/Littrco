import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Battery, Check, ChevronRight } from "lucide-react";
import { useState } from "react";

type QuestionType = "single" | "multi" | "text";

interface Question {
  question: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
}

const signupQuestions: Question[] = [
  {
    question: "What's your go-to vape right now?",
    type: "single",
    options: ["Disposable", "Pod system (like JUUL)", "Box mod", "Pen style", "I don't vape"],
  },
  {
    question: "How often do you vape?",
    type: "single",
    options: ["Every day", "A few times a week", "Weekends only", "Occasionally", "Trying to stop"],
  },
  {
    question: "How many disposables do you go through in a month?",
    type: "single",
    options: ["1-2", "3-5", "6-10", "10+", "I don't use disposables"],
  },
  {
    question: "What brand do you usually grab?",
    type: "text",
    placeholder: "e.g. Elf Bar, Lost Mary, JUUL...",
  },
  {
    question: "How long have you been vaping?",
    type: "single",
    options: ["Less than 6 months", "6 months - 1 year", "1-2 years", "3+ years"],
  },
  {
    question: "Have you noticed any changes since you started?",
    type: "multi",
    options: ["Shortness of breath", "Coughing more", "Headaches", "Throat irritation", "No changes", "Other"],
  },
  {
    question: "What's your age range?",
    type: "single",
    options: ["Under 18", "18-24", "25-34", "35-44", "45+"],
  },
  {
    question: "What would make you recycle more?",
    type: "single",
    options: ["More drop-off spots", "Better rewards", "Easier process", "I already recycle", "Nothing honestly"],
  },
];

const weeklyQuestions: Question[] = [
  {
    question: "How's your week been with vaping?",
    type: "single",
    options: ["Same as usual", "Vaped more", "Vaped less", "Didn't vape"],
  },
  {
    question: "What'd you use this week?",
    type: "single",
    options: ["Disposable", "Pod", "Mod", "Mixed", "Nothing"],
  },
  {
    question: "Did you recycle any vapes this week?",
    type: "single",
    options: ["Yes", "No", "Didn't have any to recycle"],
  },
  {
    question: "How are you feeling physically?",
    type: "single",
    options: ["Great", "Normal", "Not great", "Noticed something new"],
  },
  {
    question: "Anything on your mind about vaping you want to share?",
    type: "text",
    placeholder: "Type anything here... or skip this one",
    optional: true,
  },
];

export default function BonusPage() {
  const { user, role } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeSurvey, setActiveSurvey] = useState<"signup" | "weekly" | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [successData, setSuccessData] = useState<{ batteries: number } | null>(null);

  const { data: surveyStatus, isLoading } = useQuery({
    queryKey: ["survey-status"],
    queryFn: async () => {
      const res = await apiRequest("/api/customer/survey/status");
      if (!res.ok) throw new Error("Failed to fetch survey status");
      return res.json();
    },
    enabled: !!user,
  });

  const submitSurvey = useMutation({
    mutationFn: async ({ surveyType, answers }: { surveyType: string; answers: Record<number, string | string[]> }) => {
      const res = await apiRequest("/api/customer/survey", {
        method: "POST",
        body: JSON.stringify({ surveyType, answers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit survey");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["survey-status"] });
      queryClient.invalidateQueries({ queryKey: ["customer-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["customer-transactions"] });
      const batteries = activeSurvey === "signup" ? 20 : 3;
      setSuccessData({ batteries });
      setActiveSurvey(null);
      setCurrentStep(0);
      setAnswers({});
    },
    onError: (error: any) => {
      alert(error.message);
    },
  });

  if (!user || role !== "customer") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4" data-testid="text-login-prompt">Please log in to access bonus surveys</p>
          <Button onClick={() => setLocation("/app/login")} className="littr-btn littr-btn-primary" data-testid="button-login">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (successData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4 animate-fade-in">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto mb-6 animate-slide-up">
            <Battery className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-success-title">Thanks for sharing!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2" data-testid="text-success-message">
            You earned <span className="text-gray-900 dark:text-gray-100 font-semibold">{successData.batteries} batteries</span>
          </p>
          <p className="text-gray-400 text-sm mb-8">Your answers help us understand how vaping affects people and the environment.</p>
          <Button
            onClick={() => {
              setSuccessData(null);
            }}
            className="w-full littr-btn littr-btn-primary"
            data-testid="button-back-to-bonus"
          >
            Back to Bonus
          </Button>
          <Button
            variant="ghost"
            onClick={() => setLocation("/app")}
            className="w-full mt-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
            data-testid="button-back-to-wallet"
          >
            Back to Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (activeSurvey) {
    const questions = activeSurvey === "signup" ? signupQuestions : weeklyQuestions;
    const totalSteps = questions.length;
    const currentQuestion = questions[currentStep];
    const progress = ((currentStep + 1) / totalSteps) * 100;

    const currentAnswer = answers[currentStep];
    const isTextQuestion = currentQuestion.type === "text";
    const isMultiSelect = currentQuestion.type === "multi";
    const canProceed = currentQuestion.optional || (isTextQuestion ? typeof currentAnswer === "string" && currentAnswer.trim().length > 0 : isMultiSelect ? Array.isArray(currentAnswer) && currentAnswer.length > 0 : !!currentAnswer);
    const isLastStep = currentStep === totalSteps - 1;

    const handleSelectOption = (option: string) => {
      if (isMultiSelect) {
        const current = (answers[currentStep] as string[]) || [];
        if (current.includes(option)) {
          setAnswers({ ...answers, [currentStep]: current.filter((o) => o !== option) });
        } else {
          setAnswers({ ...answers, [currentStep]: [...current, option] });
        }
      } else {
        setAnswers({ ...answers, [currentStep]: option });
      }
    };

    const handleNext = () => {
      if (isLastStep) {
        submitSurvey.mutate({ surveyType: activeSurvey, answers });
      } else {
        setCurrentStep(currentStep + 1);
      }
    };

    const handleBack = () => {
      if (currentStep === 0) {
        setActiveSurvey(null);
        setCurrentStep(0);
        setAnswers({});
      } else {
        setCurrentStep(currentStep - 1);
      }
    };

    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <div className="bg-gray-900 dark:bg-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="text-white" data-testid="button-survey-back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-white text-sm" data-testid="text-survey-title">
            {activeSurvey === "signup" ? "Sign-up Survey" : "Weekly Check-in"}
          </h1>
        </div>

        <div className="px-4 pt-3">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
          <p className="text-gray-400 text-xs mt-2 text-right" data-testid="text-step-counter">
            {currentStep + 1} of {totalSteps}
          </p>
        </div>

        <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full animate-fade-in" key={currentStep}>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed" data-testid="text-survey-note">
            Your answers help us learn how different vapes affect people and the environment. No wrong answers — just be real with us.
          </p>

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6" data-testid="text-question">
            {currentQuestion.question}
          </h2>

          {isTextQuestion && (
            <input
              type="text"
              className="littr-input w-full"
              placeholder={currentQuestion.placeholder}
              value={(currentAnswer as string) || ""}
              onChange={(e) => setAnswers({ ...answers, [currentStep]: e.target.value })}
              data-testid="input-text-answer"
            />
          )}

          {!isTextQuestion && currentQuestion.options && (
            <div className="space-y-3 animate-slide-up">
              {currentQuestion.options.map((option) => {
                const isSelected = isMultiSelect
                  ? Array.isArray(currentAnswer) && currentAnswer.includes(option)
                  : currentAnswer === option;

                return (
                  <button
                    key={option}
                    onClick={() => handleSelectOption(option)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    data-testid={`option-${option.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    <span className="font-medium text-sm">{option}</span>
                    {isSelected && isMultiSelect && <Check className="h-4 w-4 text-green-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 max-w-lg mx-auto w-full">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 rounded-xl border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
              data-testid="button-back"
            >
              Back
            </Button>
            {isLastStep ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed && !currentQuestion.optional}
                className={`flex-1 h-12 rounded-xl ${
                  canProceed || currentQuestion.optional
                    ? "littr-btn-primary"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                }`}
                data-testid="button-submit"
              >
                {submitSurvey.isPending ? "Submitting..." : "Submit"}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed && !currentQuestion.optional}
                className={`flex-1 h-12 rounded-xl ${
                  canProceed || currentQuestion.optional
                    ? "littr-btn-primary"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                }`}
                data-testid="button-next"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const signupAvailable = !surveyStatus?.signupCompleted;
  const weeklyAvailable = surveyStatus?.weeklyAvailable;
  const nextWeeklyDate = surveyStatus?.nextWeeklyDate;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="bg-gray-900 dark:bg-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/app")} className="text-white" data-testid="button-back-nav">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold text-white text-sm" data-testid="text-page-title">Bonus</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-50 dark:bg-green-950 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Star className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1" data-testid="text-bonus-heading">Earn Extra Batteries</h2>
          <p className="text-gray-400 text-sm">Complete surveys to earn bonus rewards</p>
        </div>

        <button
          onClick={() => {
            if (signupAvailable) {
              setActiveSurvey("signup");
              setCurrentStep(0);
              setAnswers({});
            }
          }}
          disabled={!signupAvailable}
          className={`w-full text-left rounded-xl border p-5 transition-all ${
            signupAvailable
              ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm active:scale-[0.98]"
              : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60"
          }`}
          data-testid="card-signup-survey"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Sign-up Survey</h3>
                {!signupAvailable && (
                  <span className="littr-badge littr-badge-green text-[10px]" data-testid="badge-signup-completed">Completed</span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Tell us about your vaping habits</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Battery className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">20 batteries</span>
                </div>
                <span className="text-xs text-gray-400">~2 min</span>
              </div>
            </div>
            {signupAvailable && <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 mt-1" />}
          </div>
        </button>

        <button
          onClick={() => {
            if (weeklyAvailable) {
              setActiveSurvey("weekly");
              setCurrentStep(0);
              setAnswers({});
            }
          }}
          disabled={!weeklyAvailable}
          className={`w-full text-left rounded-xl border p-5 transition-all ${
            weeklyAvailable
              ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm active:scale-[0.98]"
              : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60"
          }`}
          data-testid="card-weekly-survey"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Weekly Check-in</h3>
                {!weeklyAvailable && !isLoading && (
                  <span className="littr-badge littr-badge-yellow text-[10px]" data-testid="badge-weekly-unavailable">
                    {nextWeeklyDate ? `Available ${new Date(nextWeeklyDate).toLocaleDateString()}` : "Completed"}
                  </span>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">Quick update on your week</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Battery className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">3 batteries</span>
                </div>
                <span className="text-xs text-gray-400">~1 min</span>
              </div>
            </div>
            {weeklyAvailable && <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 mt-1" />}
          </div>
        </button>

        {isLoading && (
          <div className="text-center py-8" data-testid="text-loading">
            <p className="text-gray-400 text-sm">Loading surveys...</p>
          </div>
        )}
      </div>
    </div>
  );
}
