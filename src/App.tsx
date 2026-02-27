/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  BrainCircuit, 
  BookOpen, 
  PenTool, 
  Link as LinkIcon, 
  FileCheck, 
  FileDown, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  User,
  Zap,
  FileText,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { DB_OFICIAL, DATA_NEM, EJES, RASGOS, ESTRATEGIAS_NACIONALES } from './data';
import { analyzeContextWithAI, generateProjectDetailsWithAI, distributeContentsWithAI } from './lib/gemini';
import { AppData, ContentPDA, ProjectData } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'maravill_aula_data';

export default function App() {
  const [screen, setScreen] = useState<'login' | 'profile' | 'diagnosis' | 'codesign' | 'report'>('login');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading saved data", e);
      }
    }
    return {
      teacher: '',
      field: 'Lenguajes',
      discipline: '',
      grade: '1',
      methodology: 'Aprendizaje Basado en Problemas (ABP)',
      context: '',
      problems: [],
      dosification: { 1: [], 2: [], 3: [] },
      projects: {}
    };
  });
  const [aiProblems, setAiProblems] = useState<string[]>([]);
  const [currentTri, setCurrentTri] = useState(1);
  const [manualProduct, setManualProduct] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screen !== 'login') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, screen]);

  const validateLogin = () => {
    if (password.toUpperCase() === '29DES0039G') {
      setScreen('profile');
    } else {
      alert('CLAVE INCORRECTA');
    }
  };

  const goToDiagnosis = () => {
    if (!data.teacher || !data.discipline) {
      alert('Por favor complete todos los campos.');
      return;
    }
    setScreen('diagnosis');
  };

  const analyzeContext = async () => {
    if (data.context.length < 10) {
      alert('Escribe un contexto más detallado.');
      return;
    }
    setLoading(true);
    try {
      const problems = await analyzeContextWithAI(data.context, data.discipline, data.grade);
      setAiProblems(problems);
    } catch (error) {
      console.error(error);
      alert('Error al analizar el contexto con IA.');
    } finally {
      setLoading(false);
    }
  };

  const toggleProblem = (p: string) => {
    if (data.problems.includes(p)) {
      setData(prev => ({ ...prev, problems: prev.problems.filter(x => x !== p) }));
    } else {
      if (data.problems.length >= 3) {
        alert('Solo puede seleccionar 3 problemáticas prioritarias.');
        return;
      }
      setData(prev => ({ ...prev, problems: [...prev.problems, p] }));
    }
  };

  const runAutomaticDosification = async () => {
    setLoading(true);
    try {
      const discStr = data.discipline.trim();
      const grade = data.grade;
      let contents: ContentPDA[] = [];

      const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      let dbKey = Object.keys(DB_OFICIAL).find(k => normalizeText(k) === normalizeText(discStr));
      if (!dbKey) {
        dbKey = Object.keys(DB_OFICIAL).find(k => normalizeText(k).includes(normalizeText(discStr)) || normalizeText(discStr).includes(normalizeText(k)));
      }

      if (dbKey && DB_OFICIAL[dbKey]) {
        contents = DB_OFICIAL[dbKey][grade] || [];
      } else {
        // Fallback if not in DB
        for (let i = 1; i <= 15; i++) {
          contents.push({ t: `Contenido Oficial de ${discStr} - Tema ${i}`, pda: `PDA correspondiente a ${discStr} ${grade}°` });
        }
      }

      // Intelligent distribution using AI
      const distribution = await distributeContentsWithAI(data.problems, contents);
      const dosification: Record<number, ContentPDA[]> = { 1: [], 2: [], 3: [] };

      if (distribution) {
        Object.entries(distribution).forEach(([tri, indices]) => {
          indices.forEach(idx => {
            if (contents[idx]) dosification[Number(tri)].push(contents[idx]);
          });
        });
      } else {
        // Fallback to simple distribution
        const capacity = Math.ceil(contents.length / 3);
        contents.forEach((item, index) => {
          const tri = Math.min(3, Math.floor(index / capacity) + 1);
          dosification[tri].push(item);
        });
      }

      const projects: Record<number, ProjectData> = {};
      
      // Generate initial project data for each trimester
      for (let t = 1; t <= 3; t++) {
        const problem = data.problems[t - 1];
        const aiDetails = await generateProjectDetailsWithAI(problem, data.discipline, data.grade, data.methodology);
        
        projects[t] = {
          selectedName: aiDetails?.titles[0] || `Proyecto Trimestre ${t}`,
          nameOptions: aiDetails?.titles || [],
          selectedProduct: aiDetails?.products[0] || 'Producto Integrador',
          productsAvailable: aiDetails?.products || [],
          description: aiDetails?.justification || '',
          strategy: ESTRATEGIAS_NACIONALES[0],
          selectedAxes: EJES.slice(0, 3),
          selectedTraits: RASGOS.slice(0, 3),
          orientations: aiDetails?.orientations || [],
          evaluation: aiDetails?.evaluation || []
        };
      }

      setData(prev => ({ ...prev, dosification, projects }));
      setScreen('codesign');
    } catch (error) {
      console.error(error);
      alert('Error al generar el codiseño.');
    } finally {
      setLoading(false);
    }
  };

  const updateProjectField = (tri: number, field: keyof ProjectData, value: any) => {
    setData(prev => ({
      ...prev,
      projects: {
        ...prev.projects,
        [tri]: {
          ...prev.projects[tri],
          [field]: value
        }
      }
    }));
  };

  const downloadPDF = () => {
    if (!reportRef.current) return;
    const element = reportRef.current;
    const opt = {
      margin: 10,
      filename: `Programa_Analitico_${data.teacher.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-3 cursor-pointer" onClick={() => setScreen('login')}>
            <div className="bg-white p-1 rounded">
              <img src="https://picsum.photos/seed/maravilla/100/100" alt="Logo" className="h-8 w-auto rounded" referrerPolicy="no-referrer" />
            </div>
            <ShieldCheck className="w-6 h-6" />
            <span className="hidden sm:inline">Maravill-Aula ZONA02</span>
          </h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowGuide(true)}
              className="text-white/80 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-colors"
            >
              <HelpCircle className="w-4 h-4" /> Guía
            </button>
            {screen !== 'login' && (
              <button 
                onClick={() => {
                  if (confirm('¿Desea borrar todo el progreso y reiniciar?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    window.location.reload();
                  }
                }}
                className="text-[10px] bg-red-800 hover:bg-red-700 px-3 py-1 rounded-full font-mono transition-colors uppercase"
              >
                Reiniciar
              </button>
            )}
            <span className="text-[10px] bg-blue-800 px-3 py-1 rounded-full font-mono uppercase">V 26.2 PROBLEMATIZACIÓN</span>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setShowGuide(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Guía de Maravill-Aula</h2>
                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="space-y-6 text-slate-700">
                <section>
                  <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                    <User className="w-4 h-4" /> 1. Perfil Académico
                  </h3>
                  <p className="text-sm">Configure sus datos y la disciplina que imparte. Esto es vital para que la IA seleccione los contenidos oficiales correctos.</p>
                </section>
                <section>
                  <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4" /> 2. Diagnóstico y Problemáticas
                  </h3>
                  <p className="text-sm">Describa su contexto escolar. La IA analizará este texto para proponer problemáticas situadas. Debe elegir exactamente 3 para avanzar.</p>
                </section>
                <section>
                  <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4" /> 3. Codiseño Automático
                  </h3>
                  <p className="text-sm">Al hacer clic en "Generar Codiseño", la IA distribuirá los contenidos del programa sintético entre las 3 problemáticas y diseñará propuestas de proyectos (nombres, productos, justificación).</p>
                </section>
                <section>
                  <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" /> 4. Ajuste y Reporte
                  </h3>
                  <p className="text-sm">Revise cada trimestre, ajuste los nombres o productos si lo desea. Finalmente, genere su Programa Analítico en PDF listo para imprimir.</p>
                </section>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs italic">
                  Nota: Maravill-Aula utiliza Inteligencia Artificial para asistirle, pero usted como docente tiene la última palabra pedagógica.
                </div>
              </div>
              <button 
                onClick={() => setShowGuide(false)}
                className="w-full mt-8 bg-blue-900 text-white font-black py-4 rounded-xl hover:bg-blue-950 transition-colors uppercase tracking-widest"
              >
                ¡Entendido!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container mx-auto p-4 flex-grow max-w-[1200px]">
        <AnimatePresence mode="wait">
          {screen === 'login' && (
            <motion.section 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-20 bg-white border border-slate-200 rounded-xl p-8 shadow-xl text-center"
            >
              <h2 className="text-2xl font-bold mb-2 text-blue-900">Acceso Docente</h2>
              <p className="text-slate-500 mb-6">Esc. Sec. Gral. Leonarda Gómez Blanco</p>
              <div className="relative mb-4">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && validateLogin()}
                  className="w-full border-2 border-slate-200 p-3 rounded-lg text-center text-lg tracking-widest focus:border-blue-500 outline-none transition-colors" 
                  placeholder="••••••••••" 
                />
              </div>
              <button 
                onClick={validateLogin}
                className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold py-3 rounded-lg text-lg flex justify-center items-center gap-2 transition-all transform hover:-translate-y-1 shadow-lg"
              >
                INGRESAR <Lock className="w-5 h-5" />
              </button>
            </motion.section>
          )}

          {screen === 'profile' && (
            <motion.section 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-slate-200 rounded-xl p-8 shadow-lg"
            >
              <h2 className="text-2xl font-bold mb-6 border-b-2 border-blue-900 pb-2">1. Configuración Académica</h2>
              <div className="grid gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nombre del Docente:</label>
                    <input 
                      type="text" 
                      value={data.teacher}
                      onChange={(e) => setData(prev => ({ ...prev, teacher: e.target.value }))}
                      className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none" 
                      placeholder="Ej. Mtra. Daisy Maravilla" 
                    />
                  </div>
                  <div>
                    <label className="font-bold text-blue-900 block mb-1">Campo Formativo:</label>
                    <select 
                      value={data.field}
                      onChange={(e) => setData(prev => ({ ...prev, field: e.target.value }))}
                      className="w-full border-2 border-blue-100 p-3 rounded-lg focus:border-blue-500 outline-none bg-blue-50/30"
                    >
                      {Object.keys(DATA_NEM).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Disciplina:</label>
                    <input 
                      type="text" 
                      value={data.discipline}
                      onChange={(e) => setData(prev => ({ ...prev, discipline: e.target.value }))}
                      list="discipline-suggestions" 
                      className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none" 
                      placeholder="Ej. Tecnología" 
                    />
                    <datalist id="discipline-suggestions">
                      {Object.keys(DB_OFICIAL).map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Grado:</label>
                    <select 
                      value={data.grade}
                      onChange={(e) => setData(prev => ({ ...prev, grade: e.target.value }))}
                      className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none"
                    >
                      <option value="1">1° Primer Grado</option>
                      <option value="2">2° Segundo Grado</option>
                      <option value="3">3° Tercer Grado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Metodología:</label>
                  <select 
                    value={data.methodology}
                    onChange={(e) => setData(prev => ({ ...prev, methodology: e.target.value }))}
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none"
                  >
                    <option value="Aprendizaje Basado en Problemas (ABP)">ABP (Ética, Nat. y Soc.)</option>
                    <option value="Aprendizaje Basado en Proyectos Comunitarios">Proyectos Comunitarios (Lenguajes/Humano)</option>
                    <option value="Aprendizaje Basado en Indagación (STEAM)">STEAM (Ciencias)</option>
                    <option value="Aprendizaje Servicio (AS)">Aprendizaje Servicio (Humano)</option>
                  </select>
                </div>

                <div className="flex justify-end mt-4">
                  <button 
                    onClick={goToDiagnosis}
                    className="bg-blue-900 hover:bg-blue-950 text-white font-bold px-8 py-3 rounded-lg flex items-center gap-2 transition-all transform hover:translate-x-1"
                  >
                    Siguiente <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {screen === 'diagnosis' && (
            <motion.section 
              key="diagnosis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-slate-200 rounded-xl p-8 shadow-lg"
            >
              <h2 className="text-2xl font-bold mb-4 border-b-2 border-blue-900 pb-2">2. Problematización</h2>
              <div className="mb-6">
                <label className="block font-bold text-lg mb-2">Problematización Escolar (Contexto):</label>
                <textarea 
                  value={data.context}
                  onChange={(e) => setData(prev => ({ ...prev, context: e.target.value }))}
                  className="w-full border-2 border-slate-200 p-4 rounded-lg h-32 focus:border-blue-500 outline-none resize-none" 
                  placeholder="Describa las necesidades reales de los alumnos y la comunidad..."
                />
                <button 
                  onClick={analyzeContext}
                  disabled={loading}
                  className="mt-3 bg-blue-900 hover:bg-blue-950 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                  ANALIZAR Y GENERAR PROBLEMÁTICAS CON IA
                </button>
              </div>

              {aiProblems.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="border-t pt-6"
                >
                  <p className="font-bold text-lg text-blue-900 mb-4">Seleccione 3 Problemáticas Prioritarias:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {aiProblems.map((p, idx) => (
                      <button 
                        key={idx}
                        onClick={() => toggleProblem(p)}
                        className={cn(
                          "text-left p-4 rounded-lg border-2 transition-all text-sm",
                          data.problems.includes(p) 
                            ? "border-blue-900 bg-blue-50 text-blue-900 font-bold shadow-sm" 
                            : "border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="text-right">
                    <button 
                      onClick={runAutomaticDosification}
                      disabled={data.problems.length !== 3 || loading}
                      className="bg-blue-900 hover:bg-blue-950 text-white font-bold px-8 py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto shadow-xl"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      GENERAR CODISEÑO ⚡
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.section>
          )}

          {screen === 'codesign' && (
            <motion.section 
              key="codesign"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto"
            >
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-lg">
                <div className="mb-6 border-b border-slate-200 pb-4 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-900">3. Codiseño y Planeación Didáctica</h2>
                    <p className="text-sm text-slate-500">Dosificación Oficial Completa y Diseño Dinámico con IA.</p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-400">
                    {data.teacher} | {data.discipline} {data.grade}°
                  </div>
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {[1, 2, 3].map(t => (
                    <button 
                      key={t}
                      onClick={() => setCurrentTri(t)}
                      className={cn(
                        "flex-1 min-w-[120px] py-3 font-bold rounded-t-lg transition-all",
                        currentTri === t ? "bg-blue-900 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      Trimestre {t}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-b-lg">
                  <div className="bg-red-50 border-l-4 border-red-500 p-5 mb-8 shadow-sm rounded-r-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-xs font-bold text-red-800 uppercase tracking-widest">Problemática Prioritaria del Trimestre:</p>
                    </div>
                    <p className="text-2xl font-black text-red-900 uppercase leading-tight tracking-tight">
                      {data.problems[currentTri - 1]}
                    </p>
                  </div>

                  <div className="mb-10">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-xl text-slate-800">
                      <BookOpen className="w-6 h-6 text-blue-600" /> 
                      Contenidos y PDA Articulados
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md bg-white">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
                            <th className="w-1/3 p-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Contenido (Programa Sintético)</th>
                            <th className="w-2/3 p-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Proceso de Desarrollo de Aprendizaje (PDA)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.dosification[currentTri]?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                              <td className="p-4 text-xs font-bold text-blue-900 align-top leading-relaxed group-hover:text-blue-700">{item.t}</td>
                              <td className="p-4 text-xs text-slate-600 leading-relaxed align-top">{item.pda}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {data.dosification[currentTri]?.length === 0 && (
                        <div className="p-10 text-center text-slate-400 italic">
                          No hay contenidos asignados para este trimestre.
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-3 px-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Fuente: Programa Sintético Oficial 2022
                      </p>
                      <p className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">
                        {data.dosification[currentTri]?.length} Contenidos
                      </p>
                    </div>
                  </div>

                  <div className="relative py-4 mb-10">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t-2 border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-6 text-sm font-black text-blue-900 uppercase tracking-[0.3em]">Codiseño Pedagógico</span>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8 mb-10">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-bold mb-6 flex items-center gap-2 text-lg text-blue-900">
                          <PenTool className="w-5 h-5" /> 
                          Identidad del Proyecto
                        </h3>
                        <div className="grid gap-6">
                          <div>
                            <label className="font-black text-[11px] uppercase tracking-wider text-slate-500 block mb-2">Nombre Sugerido por IA:</label>
                            <select 
                              value={data.projects[currentTri]?.selectedName}
                              onChange={(e) => updateProjectField(currentTri, 'selectedName', e.target.value)}
                              className="w-full border-2 border-slate-200 p-4 rounded-xl focus:border-blue-500 outline-none bg-slate-50 font-bold text-slate-800 transition-all"
                            >
                              {data.projects[currentTri]?.nameOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="font-black text-[11px] uppercase tracking-wider text-slate-500 block mb-2">Producto Integrador Final:</label>
                            <div className="space-y-3">
                              <select 
                                value={manualProduct ? 'OTRO' : data.projects[currentTri]?.selectedProduct}
                                onChange={(e) => {
                                  if (e.target.value === 'OTRO') {
                                    setManualProduct(true);
                                  } else {
                                    setManualProduct(false);
                                    updateProjectField(currentTri, 'selectedProduct', e.target.value);
                                  }
                                }}
                                className="w-full border-2 border-slate-200 p-4 rounded-xl focus:border-blue-500 outline-none bg-slate-50 font-bold text-slate-800 transition-all"
                              >
                                {data.projects[currentTri]?.productsAvailable.map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="OTRO">-- DEFINIR PRODUCTO PERSONALIZADO --</option>
                              </select>
                              {manualProduct && (
                                <motion.input 
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  type="text"
                                  placeholder="Escriba el producto integrador aquí..."
                                  className="w-full border-2 border-blue-200 p-4 rounded-xl focus:border-blue-500 outline-none bg-blue-50/50 font-bold text-blue-900"
                                  onBlur={(e) => updateProjectField(currentTri, 'selectedProduct', e.target.value)}
                                />
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="font-black text-[11px] uppercase tracking-wider text-slate-500 block mb-2">Justificación y Propósito:</label>
                            <textarea 
                              value={data.projects[currentTri]?.description}
                              onChange={(e) => updateProjectField(currentTri, 'description', e.target.value)}
                              className="w-full border-2 border-slate-200 p-5 rounded-xl h-40 focus:border-blue-500 outline-none resize-none bg-slate-50 text-sm leading-relaxed text-slate-700" 
                              placeholder="La justificación explica el por qué de este proyecto..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-teal-50/50 p-8 rounded-3xl border border-teal-100 shadow-sm">
                        <div className="grid md:grid-cols-2 gap-10">
                          <div>
                            <h4 className="font-black text-teal-900 mb-5 flex items-center gap-2 uppercase tracking-widest text-xs">
                              <div className="w-2 h-2 rounded-full bg-teal-500" /> Orientaciones Didácticas
                            </h4>
                            <ul className="space-y-4 text-sm text-slate-700">
                              {data.projects[currentTri]?.orientations.map((o, i) => (
                                <li key={i} className="flex items-start gap-3 leading-relaxed">
                                  <span className="text-teal-600 font-black mt-0.5">0{i+1}.</span> 
                                  <span>{o}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-black text-teal-900 mb-5 flex items-center gap-2 uppercase tracking-widest text-xs">
                              <div className="w-2 h-2 rounded-full bg-teal-500" /> Evaluación Formativa
                            </h4>
                            <ul className="space-y-4 text-sm text-slate-700">
                              {data.projects[currentTri]?.evaluation.map((e, i) => (
                                <li key={i} className="flex items-start gap-3 leading-relaxed">
                                  <span className="text-teal-600 font-black mt-0.5">→</span> 
                                  <span>{e}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10">
                          <LinkIcon className="w-32 h-32" />
                        </div>
                        <h3 className="font-black text-emerald-300 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                          Vinculación NEM
                        </h3>
                        <div className="space-y-8">
                          <div>
                            <strong className="text-white block mb-3 text-sm font-bold">Ejes Articuladores:</strong>
                            <div className="flex flex-wrap gap-2">
                              {data.projects[currentTri]?.selectedAxes.map(x => (
                                <span key={x} className="bg-emerald-800/50 border border-emerald-700 text-[10px] px-3 py-1.5 rounded-full font-bold">
                                  {x}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <strong className="text-white block mb-3 text-sm font-bold">Perfil de Egreso:</strong>
                            <ul className="space-y-3">
                              {data.projects[currentTri]?.selectedTraits.map(x => (
                                <li key={x} className="text-[11px] text-emerald-100 leading-tight flex gap-2">
                                  <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                                  {x}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="pt-6 border-t border-emerald-800">
                            <strong className="text-emerald-300 block text-[10px] uppercase tracking-widest mb-1">Estrategia Nacional:</strong> 
                            <p className="font-black text-sm">{data.projects[currentTri]?.strategy}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl">
                        <h4 className="font-black text-indigo-300 mb-4 uppercase tracking-widest text-[10px]">Fundamentación del Campo:</h4>
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs text-indigo-100 text-justify leading-relaxed italic opacity-80">
                              "{DATA_NEM[data.field]?.fin}"
                            </p>
                          </div>
                          <div className="pt-4 border-t border-indigo-800">
                            <h4 className="font-black text-indigo-300 mb-2 uppercase tracking-widest text-[10px]">Especificidades:</h4>
                            <p className="text-[11px] text-indigo-50 text-justify leading-relaxed">
                              {DATA_NEM[data.field]?.esp}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
                    <p className="text-xs text-slate-400 font-medium">
                      * Todos los campos son editables. Los cambios se guardan automáticamente.
                    </p>
                    <button 
                      onClick={() => setScreen('report')}
                      className="bg-blue-900 hover:bg-blue-950 text-white font-black px-12 py-5 rounded-2xl shadow-2xl text-xl flex items-center gap-4 transition-all transform hover:-translate-y-2 active:translate-y-0"
                    >
                      <FileCheck className="w-7 h-7" /> VISTA PREVIA FINAL
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {screen === 'report' && (
            <motion.section 
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white max-w-5xl mx-auto mb-20"
            >
              <div className="mb-8 flex justify-between items-center bg-slate-100 p-4 rounded-xl sticky top-20 z-40 shadow-sm">
                <button 
                  onClick={() => setScreen('codesign')}
                  className="text-slate-600 hover:text-blue-900 font-bold flex items-center gap-1 transition-colors"
                >
                  ← Volver al Editor
                </button>
                <button 
                  onClick={downloadPDF}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-lg flex items-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  <FileDown className="w-5 h-5" /> DESCARGAR PROGRAMA ANALÍTICO (PDF)
                </button>
              </div>

              <div ref={reportRef} className="p-12 bg-white border border-slate-100 shadow-2xl rounded-sm text-slate-900 font-serif">
                <header className="text-center border-b-8 border-double border-slate-900 pb-10 mb-12">
                  <div className="flex justify-center mb-8">
                    <img src="https://picsum.photos/seed/maravilla/200/200" alt="Logo" className="h-28 w-auto rounded-xl shadow-md" referrerPolicy="no-referrer" />
                  </div>
                  <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 mb-2">Maravill-Aula</h1>
                  <p className="text-3xl italic text-slate-600 font-serif mb-8">Escuela Secundaria General "Leonarda Gómez Blanco"</p>
                  
                  <div className="mt-12 grid grid-cols-2 gap-8 text-left border-4 border-slate-900 p-8 rounded-none bg-white text-xs uppercase tracking-widest font-sans font-bold">
                    <div className="space-y-2">
                      <p className="border-b border-slate-200 pb-1">Docente: <span className="text-blue-900">{data.teacher}</span></p>
                      <p className="border-b border-slate-200 pb-1">Campo Formativo: <span className="text-blue-900">{data.field}</span></p>
                    </div>
                    <div className="space-y-2">
                      <p className="border-b border-slate-200 pb-1">Disciplina: <span className="text-blue-900">{data.discipline}</span></p>
                      <p className="border-b border-slate-200 pb-1">Grado y Grupo: <span className="text-blue-900">{data.grade}° GRADO</span></p>
                    </div>
                  </div>
                  <div className="mt-6 text-[10px] font-sans font-black uppercase tracking-[0.5em] text-slate-400">
                    Programa Analítico | Ciclo Escolar 2025-2026
                  </div>
                </header>

                <div className="mb-16 p-10 border-l-8 border-slate-900 bg-slate-50">
                  <h3 className="font-black uppercase mb-6 text-xl flex items-center gap-3 font-sans">
                    <BrainCircuit className="w-6 h-6" /> I. Diagnóstico Socioeducativo
                  </h3>
                  <p className="text-justify text-slate-800 leading-relaxed text-lg first-letter:text-6xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-slate-900">
                    {data.context}
                  </p>
                </div>

                <div className="space-y-20">
                  {[1, 2, 3].map(t => {
                    const p = data.projects[t];
                    const prob = data.problems[t - 1];
                    return (
                      <div key={t} className="page-break border-t-4 border-slate-900 pt-12 relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-2 font-black text-2xl font-sans uppercase tracking-[0.3em]">
                          Trimestre 0{t}
                        </div>
                        
                        <div className="bg-red-900 text-white p-6 font-black mb-10 rounded-none uppercase tracking-widest shadow-lg text-center font-sans border-b-4 border-red-950">
                          Problemática: {prob}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                          <div className="md:col-span-2 space-y-8">
                            <div>
                              <h4 className="font-black text-[10px] uppercase text-slate-400 mb-2 font-sans tracking-widest">Nombre del Proyecto:</h4>
                              <p className="text-3xl font-black text-slate-900 leading-tight font-sans uppercase">{p?.selectedName}</p>
                            </div>
                            <div>
                              <h4 className="font-black text-[10px] uppercase text-slate-400 mb-2 font-sans tracking-widest">Justificación Pedagógica:</h4>
                              <p className="text-base text-slate-700 text-justify leading-relaxed italic border-l-4 border-slate-200 pl-6">
                                {p?.description}
                              </p>
                            </div>
                          </div>
                          <div className="bg-slate-50 p-6 border border-slate-200">
                            <h4 className="font-black text-[10px] uppercase text-slate-400 mb-4 font-sans tracking-widest">Metodología y Producto:</h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Metodología:</p>
                                <p className="text-sm font-black text-slate-900 uppercase">{data.methodology}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Producto Final:</p>
                                <p className="text-sm font-black text-blue-900 uppercase">{p?.selectedProduct}</p>
                              </div>
                              <div className="pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Estrategia:</p>
                                <p className="text-[10px] font-black text-slate-900 uppercase">{p?.strategy}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-12">
                          <h4 className="font-black text-[10px] uppercase text-slate-400 mb-4 font-sans tracking-widest">Contenidos y PDA Articulados:</h4>
                          <table className="w-full border-collapse text-[11px] font-sans">
                            <thead className="bg-slate-900 text-white">
                              <tr>
                                <th className="border border-slate-900 p-3 text-left w-1/3 uppercase tracking-widest">Contenido</th>
                                <th className="border border-slate-900 p-3 text-left w-2/3 uppercase tracking-widest">PDA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.dosification[t]?.map((i, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                  <td className="border border-slate-200 p-3 font-black align-top text-blue-900">{i.t}</td>
                                  <td className="border border-slate-200 p-3 align-top text-slate-700 leading-relaxed">{i.pda}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-2 gap-12 pt-10 border-t-2 border-slate-100 font-sans">
                          <div className="bg-teal-50/30 p-6">
                            <h4 className="font-black text-[10px] uppercase text-teal-900 mb-5 tracking-widest border-b border-teal-200 pb-2">Orientaciones Didácticas:</h4>
                            <ul className="space-y-3 text-[12px] text-slate-800">
                              {p?.orientations.map((o, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="text-teal-600 font-black">0{i+1}.</span> {o}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-blue-50/30 p-6">
                            <h4 className="font-black text-[10px] uppercase text-blue-900 mb-5 tracking-widest border-b border-blue-200 pb-2">Evaluación Formativa:</h4>
                            <ul className="space-y-3 text-[12px] text-slate-800">
                              {p?.evaluation.map((e, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="text-blue-600 font-black">→</span> {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-10 grid grid-cols-2 gap-8 text-[9px] font-sans font-bold uppercase tracking-widest text-slate-400">
                          <div>
                            Ejes: {p?.selectedAxes.join(" • ")}
                          </div>
                          <div className="text-right">
                            Esc. Sec. Gral. Leonarda Gómez Blanco
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <footer className="mt-32 pt-12 border-t-4 border-slate-900 flex justify-around text-center font-sans">
                  <div className="w-72">
                    <div className="border-b-2 border-slate-900 mb-4 h-16"></div>
                    <p className="text-sm font-black uppercase tracking-widest">{data.teacher}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Docente Titular de la Disciplina</p>
                  </div>
                  <div className="w-72">
                    <div className="border-b-2 border-slate-900 mb-4 h-16"></div>
                    <p className="text-sm font-black uppercase tracking-widest">Dirección Escolar</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Sello y Firma de Validación</p>
                  </div>
                </footer>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="bg-slate-100 border-t border-slate-200 p-6 text-center text-slate-400 text-xs">
        <p>© 2026 Maravill-Aula | Desarrollado para la Zona Escolar 02</p>
        <p className="mt-1">Impulsado por Inteligencia Artificial para la Excelencia Educativa</p>
      </footer>
    </div>
  );
}
