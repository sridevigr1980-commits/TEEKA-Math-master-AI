
import React, { useState, useRef, useEffect } from 'react';
import { Tab, Message, GradeLevel, MathTopic, Question } from './types';
import { 
  chatWithThinking, 
  generateMathImage, 
  generateMathVideo, 
  analyzeMathVisual, 
  speakText,
  generateLesson,
  generateQuestions,
  evaluateAnswers
} from './services/geminiService';
import { LiveVoiceSession } from './components/LiveVoiceSession';

const GRADE_LEVELS: GradeLevel[] = [
  'Elementary School', 
  'Middle School', 
  'High School', 
  'University', 
  'Professional/Research'
];

const TOPICS = Object.values(MathTopic);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  
  // Lesson & Assignment States
  const [currentLesson, setCurrentLesson] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGrading, setIsGrading] = useState(false);

  // Learning Profile State
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | null>(() => {
    return localStorage.getItem('gradeLevel') as GradeLevel || null;
  });
  const [selectedTopic, setSelectedTopic] = useState<MathTopic | null>(() => {
    return localStorage.getItem('selectedTopic') as MathTopic || null;
  });
  const [showSetup, setShowSetup] = useState(!gradeLevel || !selectedTopic);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gradeLevel) localStorage.setItem('gradeLevel', gradeLevel);
    if (selectedTopic) localStorage.setItem('selectedTopic', selectedTopic);
  }, [gradeLevel, selectedTopic]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gradeLevel || !selectedTopic) return;

    const userMessage: Message = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithThinking(input, gradeLevel, selectedTopic, messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })));
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.text || "I couldn't generate a response.",
        timestamp: Date.now(),
        thinking: (response as any).candidates?.[0]?.thinking
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!gradeLevel || !selectedTopic) return;
    setIsLoading(true);
    try {
      const lesson = await generateLesson(gradeLevel, selectedTopic);
      setCurrentLesson(lesson || "Could not generate lesson.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!gradeLevel || !selectedTopic) return;
    setIsLoading(true);
    try {
      const qs = await generateQuestions(gradeLevel, selectedTopic);
      setQuestions(qs.map((q: any) => ({ ...q, userAnswer: '' })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeAssignment = async () => {
    if (!gradeLevel || !selectedTopic) return;
    setIsGrading(true);
    try {
      const evaluations = await evaluateAnswers(gradeLevel, selectedTopic, questions);
      setQuestions(prev => prev.map(q => {
        const evalItem = evaluations.find((e: any) => e.id === q.id);
        return evalItem ? { ...q, ...evalItem } : q;
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGrading(false);
    }
  };

  const handleVisualize = async () => {
    if (!input.trim() || !gradeLevel || !selectedTopic) return;
    setIsLoading(true);
    try {
      const url = await generateMathImage(input, gradeLevel, selectedTopic, "16:9", "1K");
      setGeneratedImage(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnimate = async () => {
    if (!input.trim() || !gradeLevel || !selectedTopic) return;
    setIsLoading(true);
    try {
      const url = await generateMathVideo(input, gradeLevel, selectedTopic, '16:9');
      setGeneratedVideo(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gradeLevel || !selectedTopic) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const analysis = await analyzeMathVisual(base64, file.type, "Please solve the math problem in this image and explain the steps.", gradeLevel, selectedTopic);
        setMessages(prev => [...prev, { role: 'assistant', content: analysis || "Analyzed.", timestamp: Date.now() }]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSpeak = async (text: string) => {
    const audioData = await speakText(text);
    if (!audioData) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const binary = atob(audioData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, int16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768.0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };

  const completeSetup = () => {
    if (gradeLevel && selectedTopic) {
      setShowSetup(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Setup Wizard Modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 bg-indigo-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Personalize Your Tutor</h2>
            <p className="text-slate-500 mb-8">Tell us your level and focus so we can tailor the math experience for you.</p>
            
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 text-sm">1</span>
                  What is your grade level?
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GRADE_LEVELS.map(level => (
                    <button
                      key={level}
                      onClick={() => setGradeLevel(level)}
                      className={`px-4 py-3 rounded-xl border-2 transition text-sm font-medium ${gradeLevel === level ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 text-sm">2</span>
                  What topic are you studying?
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TOPICS.map(topic => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(topic)}
                      className={`px-4 py-3 rounded-xl border-2 transition text-sm font-medium ${selectedTopic === topic ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </section>

              <button
                disabled={!gradeLevel || !selectedTopic}
                onClick={completeSetup}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-xl"
              >
                Start Learning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-indigo-900 text-white flex flex-col p-6 space-y-4">
        <div className="flex items-center space-x-2 mb-8">
          <div className="bg-white p-2 rounded-lg text-indigo-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">TEEKA Math master AI</h1>
        </div>

        <div className="mb-8 p-4 bg-indigo-800/50 rounded-2xl border border-indigo-700/50">
          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider mb-2">Current Context</p>
          <p className="text-sm font-bold truncate">{gradeLevel}</p>
          <p className="text-xs text-indigo-200 mb-3">{selectedTopic}</p>
          <button 
            onClick={() => setShowSetup(true)}
            className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition font-bold"
          >
            Change Context
          </button>
        </div>

        <div className="space-y-1">
          <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'chat' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">AI Chatbot</span>
          </button>
          <button onClick={() => setActiveTab('lessons')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'lessons' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">Lesson Lab</span>
          </button>
          <button onClick={() => setActiveTab('assignments')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'assignments' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">Assignment Zone</span>
          </button>
          <button onClick={() => setActiveTab('voice')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'voice' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">Live Voice</span>
          </button>
          <button onClick={() => setActiveTab('solve')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'solve' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">Snap & Solve</span>
          </button>
          <button onClick={() => setActiveTab('visualize')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${activeTab === 'visualize' ? 'bg-indigo-700 shadow-inner' : 'hover:bg-indigo-800'}`}>
            <span className="font-medium">Visual Lab</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative max-h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'chat' && 'AI Math Tutor'}
              {activeTab === 'lessons' && 'Lesson Lab'}
              {activeTab === 'assignments' && 'Assignment Zone'}
              {activeTab === 'voice' && 'Live Conversational Learning'}
              {activeTab === 'solve' && 'Visual Problem Analysis'}
              {activeTab === 'visualize' && 'Mathematical Visualization'}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-slate-500">
              <span>{gradeLevel}</span>
              <span className="text-slate-300">|</span>
              <span>{selectedTopic}</span>
            </div>
          </div>
          {(isLoading || isGrading) && (
            <div className="flex items-center space-x-2 text-indigo-600 font-medium">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>{isGrading ? 'Grading...' : 'Teaching...'}</span>
            </div>
          )}
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {activeTab === 'lessons' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {!currentLesson ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="text-2xl font-bold mb-4">Start your {selectedTopic} lesson</h3>
                  <p className="text-slate-500 mb-6">We'll generate a personalized curriculum for your level.</p>
                  <button onClick={handleGenerateLesson} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
                    Generate Lesson Plan
                  </button>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-800">Lesson: {selectedTopic}</h3>
                    <div className="flex space-x-2">
                      <button onClick={() => handleSpeak(currentLesson)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center">
                        Speak Lesson
                      </button>
                      <button onClick={handleGenerateLesson} className="text-slate-400 hover:text-slate-600 text-sm px-4 py-2">Refresh</button>
                    </div>
                  </div>
                  <div className="prose prose-indigo max-w-none prose-headings:text-indigo-900 prose-blockquote:border-indigo-500">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700">{currentLesson}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {questions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="text-2xl font-bold mb-4">Practice Makes Perfect</h3>
                  <p className="text-slate-500 mb-6">Ready to test your knowledge on {selectedTopic}?</p>
                  <button onClick={handleGenerateQuestions} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
                    Create Practice Set
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                      <div className="flex items-start justify-between mb-4">
                        <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mr-4">
                          {idx + 1}
                        </span>
                        <p className="text-lg font-medium text-slate-800 flex-1">{q.text}</p>
                        {q.isCorrect !== undefined && (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${q.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {q.isCorrect ? 'Correct' : 'Needs Review'}
                          </span>
                        )}
                      </div>
                      <div className="ml-12 space-y-4">
                        <input
                          type="text"
                          value={q.userAnswer}
                          onChange={(e) => {
                            const newQs = [...questions];
                            newQs[idx].userAnswer = e.target.value;
                            setQuestions(newQs);
                          }}
                          placeholder="Your answer..."
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          disabled={isGrading}
                        />
                        {q.feedback && (
                          <div className={`p-4 rounded-xl text-sm ${q.isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <strong>Teacher's Note:</strong> {q.feedback}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 italic">Hint: {q.hint}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-center pt-4">
                    <button 
                      onClick={handleGradeAssignment} 
                      disabled={isGrading || questions.some(q => !q.userAnswer)}
                      className="bg-green-600 text-white px-12 py-4 rounded-2xl font-bold hover:bg-green-700 disabled:opacity-50 shadow-xl transition transform active:scale-95"
                    >
                      Submit for Grading
                    </button>
                    <button onClick={handleGenerateQuestions} className="ml-4 text-indigo-600 font-bold px-6">New Set</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-20">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">How can I help you with {selectedTopic}?</h3>
                  <p className="text-slate-500 max-w-md mx-auto">I'm ready to teach you at a {gradeLevel} level. Ask me anything!</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>
                    {m.thinking && (
                      <div className="mb-2 p-2 bg-slate-100 rounded text-xs text-slate-500 italic">
                        AI Reasoning: {m.thinking.substring(0, 150)}...
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.role === 'assistant' && (
                      <button onClick={() => handleSpeak(m.content)} className="mt-2 text-indigo-400 hover:text-indigo-600 text-xs flex items-center space-x-1">
                        <span>Listen</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center pt-10">
               {gradeLevel && selectedTopic && (
                 <LiveVoiceSession gradeLevel={gradeLevel} topic={selectedTopic} />
               )}
            </div>
          )}

          {activeTab === 'solve' && (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-dashed border-indigo-200 text-center">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                  <h3 className="text-xl font-bold text-slate-800">Solve for {gradeLevel}</h3>
                  <p className="text-slate-500 mt-2">Upload a problem related to {selectedTopic}.</p>
                </div>
              </div>
              {messages.filter(m => m.role === 'assistant').slice(-1).map((m, i) => (
                <div key={i} className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm animate-fade-in">
                  <h4 className="font-bold text-indigo-900 mb-2">Analysis</h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'visualize' && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Concept Visualization</h3>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Describe a ${selectedTopic} concept...`}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                    />
                    <div className="flex gap-2 mt-4">
                      <button onClick={handleVisualize} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">Gen Image</button>
                      <button onClick={handleAnimate} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold">Animate</button>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-200 rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center shadow-inner">
                  {generatedVideo ? <video src={generatedVideo} controls autoPlay loop className="w-full h-full object-cover" /> : 
                   generatedImage ? <img src={generatedImage} className="w-full h-full object-contain" /> : 
                   <p className="text-slate-400">Visuals appear here</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'chat' && (
          <footer className="p-6 bg-white border-t border-slate-200">
            <form onSubmit={handleChat} className="max-w-4xl mx-auto flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded-2xl shadow-lg">Send</button>
            </form>
          </footer>
        )}
      </main>
    </div>
  );
};

export default App;
