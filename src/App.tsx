import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { 
  Dumbbell, MapPin, Clock, Instagram, MessageCircle, 
  Activity, Zap, Star, Users, ShieldCheck, ChevronRight,
  X, Lock, LogOut, Trash2, Edit3, Check, ChevronDown, Award, Bot, Send
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

// --- IndexedDB Setup ---
const DB_NAME = 'DronacharyaGymDB';
const DB_VERSION = 1;
const STORE_NAME = 'inquiries';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const saveInquiry = async (data: any) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({ ...data, createdAt: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getInquiries = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const data = request.result;
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(data);
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteInquiry = async (id: number) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

function AnimatedCounter({ end, suffix = "", isFloat = false }: { end: number, suffix?: string, isFloat?: boolean }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const startTime = performance.now();
      
      const updateCount = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = progress * (2 - progress);
        const currentCount = start + (end - start) * easeOut;
        
        setCount(isFloat ? Number(currentCount.toFixed(1)) : Math.floor(currentCount));
        
        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          setCount(end);
        }
      };
      requestAnimationFrame(updateCount);
    }
  }, [isInView, end, isFloat]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin-login" element={<AdminPage />} />
      <Route path="/leads" element={<AdminPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />
    </Routes>
  );
}

function ThankYouPage() {
  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center text-center p-4">
      <div className="bg-white/5 backdrop-blur-xl p-8 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full">
        <Check className="w-16 h-16 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-black uppercase tracking-tight mb-4 text-white">Thank You!</h1>
        <p className="text-[#708090] mb-8">Your inquiry has been received. Our team will contact you shortly to schedule your free trial.</p>
        <Link to="/" className="inline-block bg-[#FF8C00] text-black font-black uppercase tracking-widest py-3 px-8 rounded-lg hover:bg-white transition-colors shadow-[0_0_15px_rgba(255,140,0,0.4)]">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function LandingPage() {
  const [dailyOffer, setDailyOffer] = useState("Join today and get 20% off on annual membership!");
  const [selectedService, setSelectedService] = useState<{title: string, details: string[], icon?: React.ReactNode} | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceInterest, setServiceInterest] = useState('General Inquiry');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'settings'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.forEach((doc) => {
        if (doc.id === 'dailyOffer') {
          setDailyOffer(doc.data().text);
        }
      });
    }, (error) => {
      console.log("Firestore not configured or error fetching offer:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleBookTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    
    setIsSubmitting(true);
    try {
      await saveInquiry({
        name,
        phone,
        serviceInterest,
        status: 'new'
      });
      setName('');
      setPhone('');
      setServiceInterest('General Inquiry');
      window.location.href = '/thank-you';
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      alert("Failed to submit. Please try again or contact via WhatsApp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { q: "What are the gym timings?", a: "We are open from 9:30 AM to 6:30 PM, Monday to Saturday." },
    { q: "Is this a unisex gym?", a: "Yes, DRONACHARYA The Gym is a premium unisex fitness center welcoming both men and women." },
    { q: "Do you provide personal training?", a: "Absolutely! We have a 'Get Your Own Trainer' program where certified coaches guide you 1-on-1 for faster results." },
    { q: "Where exactly is the gym located?", a: "We are conveniently located near Bank of Baroda, on the Main Burari Road, Sant Nagar." },
    { q: "Are there separate batches for Aerobics and Crossfit?", a: "Yes, we have dedicated zones and specific time slots for Aerobics, Cardio, and Crossfit sessions." },
    { q: "Can I get a free trial?", a: "Yes! You can book your free trial session directly through the 'Book Free Trial' button on this website." }
  ];

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FF8C00] selection:text-black">
      {/* Daily Offer Banner */}
      {dailyOffer && (
        <div className="bg-[#FF8C00] text-black text-center py-2 px-4 font-bold text-sm uppercase tracking-wider">
          {dailyOffer}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#121212]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-10 h-10 text-yellow-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black tracking-wider uppercase text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,1)] leading-none">
                  DRONACHARYA THE GYM
                </span>
                <span className="text-[10px] font-bold text-white tracking-widest uppercase mt-1">
                  Chain of Health Clubs
                </span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-gray-300">
              <a href="#home" className="hover:text-[#FF8C00] transition-colors">Home</a>
              <a href="#services" className="hover:text-[#FF8C00] transition-colors">Services</a>
              <a href="#pricing" className="hover:text-[#FF8C00] transition-colors">Pricing</a>
              <a href="#trainer" className="hover:text-[#FF8C00] transition-colors">Trainer</a>
              <a href="#faq" className="hover:text-[#FF8C00] transition-colors">FAQ</a>
            </div>
            <a
              href="#trial"
              className="hidden md:inline-flex items-center justify-center px-6 py-2 bg-[#FF8C00] text-black hover:bg-white transition-all font-black uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(255,140,0,0.5)] rounded-md"
            >
              Free Trial
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-20 pb-32 md:pt-32 md:pb-48 min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2000&auto=format&fit=crop"
            alt="3D Gym Interior"
            className="w-full h-full object-cover opacity-40 blur-[2px] scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/50 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[1] tracking-tighter mb-6 break-words">
              DRONACHARYA <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF8C00] to-orange-400">
                The Gym
              </span>
            </h1>
            
            <p className="text-2xl md:text-3xl font-bold text-white mb-4 uppercase tracking-wide">
              Burari's Powerhouse Since Years
            </p>
            
            <p className="text-lg md:text-xl text-[#708090] mb-10 font-medium uppercase tracking-widest">
              Cardio | Crossfit | Aerobics | Strengthening
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#trial"
                className="inline-flex items-center justify-center px-6 py-4 sm:px-8 bg-[#FF8C00] text-black font-black uppercase tracking-widest hover:bg-white transition-colors text-base sm:text-lg shadow-[0_0_20px_rgba(255,140,0,0.6)] rounded-md animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] ripple-btn text-center"
              >
                Book Free Trial
              </a>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center px-6 py-4 sm:px-8 border-2 border-white/20 hover:border-white transition-colors font-bold uppercase tracking-widest text-base sm:text-lg rounded-md backdrop-blur-sm ripple-btn text-center"
              >
                View Membership
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust & Authority Section */}
      <section className="bg-[#1a1a1a] border-y border-white/5 relative z-20 -mt-10 mx-4 sm:mx-8 lg:mx-auto max-w-6xl rounded-lg shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-5xl font-black text-[#FF8C00] mb-2"><AnimatedCounter end={4.1} isFloat={true} /></p>
            <div className="flex items-center justify-center gap-1 text-[#FFD700] mb-2">
              <Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current" /><Star className="w-5 h-5 fill-current opacity-50" />
            </div>
            <p className="font-bold text-sm uppercase tracking-wider text-gray-400">Google Rating</p>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-5xl font-black text-[#FF8C00] mb-2"><AnimatedCounter end={272} suffix="+" /></p>
            <p className="font-bold text-sm uppercase tracking-wider text-gray-400 flex items-center justify-center gap-1">
              Verified Members <ShieldCheck className="w-4 h-4 text-green-500" />
            </p>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-5xl font-black text-[#FF8C00] mb-2"><AnimatedCounter end={10} suffix="+" /></p>
            <p className="font-bold text-sm uppercase tracking-wider text-gray-400">Expert Trainers</p>
          </div>
        </div>
      </section>

      {/* Social Proof Marquee */}
      <div className="bg-[#FF8C00] text-black py-3 overflow-hidden mt-12">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="mx-8 font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <Star className="w-4 h-4 fill-current" />
              ★ JOIN 272+ HAPPY MEMBERS IN BURARI ★ SPECIAL BATCHES FOR AEROBICS ★ EXPERT PERSONAL TRAINING ★
            </span>
          ))}
        </div>
      </div>

      {/* Detailed Services Grid */}
      <section id="services" className="py-24 bg-[#121212]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-oswald font-bold uppercase tracking-[0.2em] mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-100 to-gray-500">
              OUR <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FF8C00] to-orange-600">SERVICES</span>
            </h2>
            <p className="text-[#708090] max-w-2xl mx-auto text-lg">Premium facilities designed for your ultimate transformation.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Unisex Gym",
                desc: "High-tech machines for everyone.",
                icon: <Users className="w-10 h-10" />,
                details: ["Premium imported equipment", "Safe and inclusive environment", "Locker and shower facilities"]
              },
              {
                title: "Crossfit & Cardio",
                desc: "Special zones for weight loss and stamina.",
                icon: <Zap className="w-10 h-10" />,
                details: ["Morning/Evening batches", "High-intensity interval training", "Expert Trainers", "Dedicated cardio floor"]
              },
              {
                title: "Aerobics",
                desc: "Group sessions with expert music and energy.",
                icon: <img src="https://storage.googleapis.com/aistudio-user-content/0-44971000-1740563787-image.jpg" alt="Aerobics" className="w-12 h-12 rounded-full object-cover border-2 border-[#FF8C00]" />,
                details: ["Morning/Evening batches", "Zumba and Step Aerobics", "Expert Trainers", "Spacious wooden floor studio"]
              },
              {
                title: "Strengthening",
                desc: "Dedicated heavy-weight area for muscle building.",
                icon: <img src="https://storage.googleapis.com/aistudio-user-content/1-44971000-1740563787-image.jpg" alt="Weightlifting" className="w-12 h-12 rounded-full object-cover border-2 border-[#FF8C00]" />,
                details: ["Olympic lifting platforms", "Extensive free weights", "Squat racks and smith machines"]
              }
            ].map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedService(service)}
                className="group cursor-pointer bg-white/5 backdrop-blur-md p-8 border border-white/10 hover:border-[#FF8C00] transition-all duration-300 hover:scale-[1.05] relative overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(255,140,0,0.15)] rounded-xl"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#FF8C00]/10 rounded-full blur-2xl group-hover:bg-[#FF8C00]/20 transition-colors" />
                <div className="text-[#FF8C00] mb-6 relative z-10 drop-shadow-[0_0_15px_rgba(255,140,0,0.3)] group-hover:drop-shadow-[0_0_25px_rgba(255,140,0,0.9)] transition-all duration-300">
                  {service.icon}
                </div>
                <h3 className="text-xl font-black uppercase tracking-wider mb-3 relative z-10">{service.title}</h3>
                <p className="text-[#708090] text-sm leading-relaxed mb-6 relative z-10">{service.desc}</p>
                <div className="flex items-center gap-2 text-[#FF8C00] text-sm font-bold uppercase tracking-wider group-hover:translate-x-2 transition-transform relative z-10">
                  View Details <ChevronRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Pricing Table */}
      <section id="pricing" className="py-24 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-oswald font-bold uppercase tracking-[0.2em] mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-100 to-gray-500">
              MEMBERSHIP <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FF8C00] to-orange-600">PLANS</span>
            </h2>
            <p className="text-[#708090] max-w-2xl mx-auto text-lg">Choose the perfect plan for your fitness journey.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center perspective-1000">
            {/* Monthly */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/20 p-8 text-center hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-all duration-500 rounded-2xl relative overflow-hidden group tilt-card">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xl font-bold uppercase tracking-wider text-gray-400 mb-4 relative z-10">Monthly</h3>
              <div className="text-4xl font-black mb-6 relative z-10">₹1,500<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 text-left relative z-10">
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> Full Gym Access</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> General Guidance</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> Locker Facility</li>
              </ul>
              <a href="#trial" className="block w-full py-3 border border-white/20 hover:bg-white hover:text-black font-bold uppercase tracking-wider transition-colors rounded-lg relative z-10 ripple-btn">Choose Plan</a>
            </div>

            {/* 3-Months (Most Popular) */}
            <div className="bg-gradient-to-b from-[#FF8C00] to-orange-600 text-black p-8 text-center relative shadow-[0_0_30px_rgba(255,140,0,0.3)] backdrop-blur-md border-2 border-[#FF8C00] rounded-2xl animate-floating tilt-card z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-[#FF8C00] px-4 py-1 text-xs font-black uppercase tracking-widest border-2 border-[#FF8C00] rounded-full shadow-[0_0_15px_rgba(255,140,0,0.8)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                Best Seller
              </div>
              <h3 className="text-xl font-black uppercase tracking-wider mb-4">3-Months</h3>
              <div className="text-5xl font-black mb-6">₹4,000<span className="text-lg font-bold opacity-70">/total</span></div>
              <ul className="space-y-4 mb-8 text-left font-medium">
                <li className="flex items-center gap-3"><Check className="w-4 h-4" /> Full Gym Access</li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4" /> Diet Consultation</li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4" /> 1 PT Session Free</li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4" /> Locker Facility</li>
              </ul>
              <a href="#trial" className="block w-full py-3 bg-black text-white hover:bg-gray-900 font-black uppercase tracking-wider transition-colors rounded-lg shadow-lg ripple-btn">Choose Plan</a>
            </div>

            {/* Yearly */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/20 p-8 text-center hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-all duration-500 rounded-2xl relative overflow-hidden group tilt-card">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xl font-bold uppercase tracking-wider text-gray-400 mb-4 relative z-10">Yearly</h3>
              <div className="text-4xl font-black mb-6 relative z-10">₹12,000<span className="text-lg text-gray-500 font-normal">/yr</span></div>
              <ul className="space-y-4 mb-8 text-left relative z-10">
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> Full Gym Access</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> Advanced Diet Plan</li>
                <li className="flex items-center gap-3 text-sm text-gray-300"><Check className="w-4 h-4 text-[#FF8C00]" /> Freeze Option (1 mo)</li>
              </ul>
              <a href="#trial" className="block w-full py-3 border border-white/20 hover:bg-white hover:text-black font-bold uppercase tracking-wider transition-colors rounded-lg relative z-10 ripple-btn">Choose Plan</a>
            </div>
          </div>
        </div>
      </section>

      {/* Personal Training & Admin Logic */}
      <section id="trainer" className="py-24 bg-[#121212] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#FF8C00]/10 border border-[#FF8C00]/20 p-8 md:p-16 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex-1">
              <div className="inline-block px-4 py-1 bg-[#FF8C00] text-black font-black uppercase tracking-widest text-xs mb-6">
                Special Service
              </div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-6 leading-[1.1]">
                Get Your <br />
                <span className="text-[#FF8C00]">Own Trainer</span>
              </h2>
              <p className="text-[#708090] text-lg mb-8 leading-relaxed max-w-xl">
                Accelerate your results with our elite Personal Training programs. Get customized workout plans, nutritional guidance, and 1-on-1 motivation from certified experts.
              </p>
              <a
                href="#trial"
                onClick={() => setServiceInterest('Personal Training')}
                className="inline-flex items-center justify-center px-8 py-4 bg-[#FF8C00] text-black font-black uppercase tracking-widest hover:bg-white transition-colors"
              >
                Get a Personal Coach
              </a>
            </div>
            <div className="flex-1 w-full max-w-md">
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800&auto=format&fit=crop" 
                alt="Personal Trainer" 
                className="w-full h-auto rounded-xl shadow-2xl border-4 border-[#1a1a1a]"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Gym Tour Gallery */}
      <section id="gallery" className="py-24 bg-[#121212] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-oswald font-bold uppercase tracking-[0.2em] mb-4 bg-clip-text text-transparent bg-gradient-to-b from-gray-100 to-gray-500">
              REAL GLIMPSES OF <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FF8C00] to-orange-600">OUR GYM</span>
            </h2>
            <p className="text-[#708090] max-w-2xl mx-auto text-lg">
              Featuring authentic 'Nortus' equipment and our dedicated Crossfit Area as seen on Justdial.
            </p>
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {[
              { img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop", caption: "Imported Machines" },
              { img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop", caption: "Group Classes" },
              { img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop", caption: "Certified Trainers" },
              { img: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop", caption: "Heavy Weight Zone" },
              { img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800&auto=format&fit=crop", caption: "Cardio Section" },
              { img: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=800&auto=format&fit=crop", caption: "Crossfit Arena" }
            ].map((item, i) => (
              <div key={i} className="relative overflow-hidden group rounded-[15px] shadow-lg break-inside-avoid hover:shadow-[0_0_20px_rgba(255,140,0,0.6)] transition-shadow duration-300">
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors z-10" />
                <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] z-10 pointer-events-none" />
                <img 
                  src={item.img} 
                  alt={item.caption} 
                  className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-700 filter contrast-125 saturate-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/90 to-transparent">
                  <p className="text-white font-bold uppercase tracking-wider text-sm">{item.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-[#1a1a1a]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">Frequently Asked <span className="text-[#FF8C00]">Questions</span></h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#121212] border border-white/5 overflow-hidden">
                <button 
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-bold text-lg pr-8">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-[#FF8C00] transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-[#708090] leading-relaxed border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact & Live Location */}
      <section id="trial" className="py-24 bg-[#121212] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            
            {/* Form */}
            <div className="bg-white/5 backdrop-blur-xl p-8 border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Contact <span className="text-[#FF8C00]">Us</span></h2>
              <p className="text-[#708090] mb-8">Securely submit your inquiry. Our team will contact you shortly.</p>
              
              {submitSuccess ? (
                <div className="bg-green-500/10 border border-green-500 text-green-500 p-6 flex items-center gap-4 rounded-lg">
                  <Check className="w-8 h-8 shrink-0" />
                  <div>
                    <h4 className="font-bold uppercase tracking-wider">Request Received!</h4>
                    <p className="text-sm opacity-80">We'll contact you shortly.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookTrial} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-4 text-white focus:outline-none focus:border-[#FF8C00] transition-colors rounded-lg"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Phone Number</label>
                    <input 
                      type="tel" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-4 text-white focus:outline-none focus:border-[#FF8C00] transition-colors rounded-lg"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Service Interest</label>
                    <select 
                      value={serviceInterest}
                      onChange={(e) => setServiceInterest(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-4 text-white focus:outline-none focus:border-[#FF8C00] transition-colors appearance-none rounded-lg"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Free Trial">Free Trial</option>
                      <option value="Personal Training">Personal Training</option>
                      <option value="Crossfit & Cardio">Crossfit & Cardio</option>
                      <option value="Aerobics">Aerobics</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-[#FF8C00] text-black font-black uppercase tracking-widest py-4 rounded-lg hover:bg-white transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(255,140,0,0.4)] hover:shadow-[0_0_25px_rgba(255,140,0,0.6)]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              )}
            </div>

            {/* Location Map */}
            <a 
              href="https://www.google.com/maps/search/Dronacharya+The+Gym+Burari+Sant+Nagar" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="block h-full min-h-[400px] w-full bg-[#1a1a1a] border border-white/10 relative group rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
            >
              <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                <button className="bg-[#FF8C00] text-black font-black uppercase tracking-widest py-3 px-6 rounded-lg animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] flex items-center gap-2 shadow-[0_0_20px_rgba(255,140,0,0.6)]">
                  <MapPin className="w-5 h-5" /> Get Directions
                </button>
              </div>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3498.489112933758!2d77.1951593!3d28.7348981!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d020000000001%3A0x0!2sBurari%2C%20Delhi!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'grayscale(100%) contrast(1.2) opacity(0.8)' }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="group-hover:scale-105 transition-transform duration-700 pointer-events-none"
              ></iframe>
            </a>

          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-black border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Column 1 */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Dumbbell className="w-10 h-10 text-yellow-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-black tracking-wider uppercase text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,1)] leading-none">
                    DRONACHARYA THE GYM
                  </span>
                  <span className="text-[10px] font-bold text-white tracking-widest uppercase mt-1">
                    Chain of Health Clubs
                  </span>
                </div>
              </div>
              <p className="text-[#708090] text-sm leading-relaxed flex items-start gap-2">
                <MapPin className="w-5 h-5 shrink-0 text-[#FF8C00]" />
                Address: Plot No -, Near Bank of Baroda, Main Burari Road
              </p>
            </div>

            {/* Column 2 */}
            <div className="md:col-span-2">
              <div className="bg-white/5 backdrop-blur-xl border border-[#FF8C00]/50 p-6 rounded-2xl shadow-[0_0_15px_rgba(255,140,0,0.2)]">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#FF8C00] animate-[spin_4s_linear_infinite]" /> Timings
                  </h4>
                  <div className="text-xs font-bold text-[#FF8C00] uppercase tracking-widest bg-[#FF8C00]/10 px-3 py-1 rounded-full border border-[#FF8C00]/30">
                    {new Date().getDay() !== 0 ? '🟢 OPEN NOW' : '🔴 CLOSED'}
                  </div>
                </div>
                <p className="font-oswald text-3xl font-black text-[#FF8C00] mb-4 tracking-tight">9:30 AM - 6:30 PM</p>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                    const isToday = new Date().toLocaleDateString('en-US', {weekday: 'short'}) === day;
                    return (
                      <span key={day} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${isToday ? 'bg-[#FF8C00] text-black animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.8)]' : 'bg-white/10 text-gray-400'}`}>
                        {day}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#708090] text-sm">
              &copy; {new Date().getFullYear()} Dronacharya The Gym. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <a href="#services" className="text-[#708090] hover:text-[#FF8C00] transition-colors">Services</a>
              <a href="#pricing" className="text-[#708090] hover:text-[#FF8C00] transition-colors">Pricing</a>
              <button onClick={() => setIsAdminModalOpen(true)} className="text-[#708090] hover:text-[#FF8C00] transition-colors flex items-center gap-1">
                <Lock className="w-3 h-3" /> Admin
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919818187123"
        target="_blank"
        rel="noopener noreferrer"
        title="Chat with DRONACHARYA Gym"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,211,102,0.5)] hover:scale-110 transition-transform flex items-center justify-center"
      >
        <MessageCircle className="w-8 h-8" />
      </a>

      {/* AI ChatBot */}
      <ChatBot />

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a1a] border border-white/10 w-full max-w-lg p-8 relative"
            >
              <button 
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-[#FF8C00] mb-6">
                {selectedService.icon}
              </div>
              <h3 className="text-2xl font-black uppercase tracking-wider mb-6">{selectedService.title}</h3>
              <ul className="space-y-4 mb-8">
                {selectedService.details.map((detail, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-[#FF8C00] shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => {
                  setServiceInterest(selectedService.title);
                  setSelectedService(null);
                  document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full bg-[#FF8C00] text-black font-black uppercase tracking-widest py-4 hover:bg-white transition-colors"
              >
                Inquire Now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 w-full max-w-md p-8 relative rounded-2xl shadow-2xl"
            >
              <button 
                onClick={() => setIsAdminModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-[#FF8C00]" />
                <h3 className="text-2xl font-black uppercase tracking-wider text-white">Owner Login</h3>
              </div>
              <p className="text-[#708090] mb-6 text-sm">Secure access for gym management.</p>
              <Link 
                to="/admin-login"
                className="w-full flex items-center justify-center gap-2 bg-[#FF8C00] text-black font-black uppercase tracking-widest py-4 rounded-lg hover:bg-white transition-colors shadow-[0_0_15px_rgba(255,140,0,0.4)]"
              >
                Proceed to Dashboard <ChevronRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Admin Page ---

function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-[#FF8C00] selection:text-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-[#FF8C00]" />
            <h2 className="text-2xl font-black uppercase tracking-wider">Admin Dashboard</h2>
          </div>
          <Link to="/" className="text-sm font-bold uppercase tracking-wider text-[#708090] hover:text-white transition-colors">
            &larr; Back to Site
          </Link>
        </div>

        {!user ? (
          <LoginForm />
        ) : (
          <AdminDashboard />
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-[#1a1a1a] p-8 border border-white/10">
      <h3 className="text-xl font-bold mb-6 text-center uppercase tracking-wider">Owner Login</h3>
      {error && <div className="bg-red-500/10 text-red-500 p-3 mb-4 text-sm border border-red-500/20">{error}</div>}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#121212] border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-[#FF8C00]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Password</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#121212] border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-[#FF8C00]"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-[#FF8C00] text-black font-bold uppercase tracking-widest py-3 mt-4 hover:bg-white transition-colors disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [offerText, setOfferText] = useState("");
  const [offerId, setOfferId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchInquiries = async () => {
      try {
        const data = await getInquiries();
        setInquiries(data);
      } catch (error) {
        console.error("Error fetching inquiries:", error);
      }
    };
    fetchInquiries();
    const interval = setInterval(fetchInquiries, 5000);

    const qOffer = query(collection(db, 'settings'));
    const unsubOffer = onSnapshot(qOffer, (snapshot) => {
      snapshot.forEach((doc) => {
        if (doc.id === 'dailyOffer') {
          setOfferText(doc.data().text);
          setOfferId(doc.id);
        }
      });
    });

    return () => {
      clearInterval(interval);
      unsubOffer();
    };
  }, []);

  const handleUpdateOffer = async () => {
    setUpdating(true);
    try {
      if (offerId) {
        await updateDoc(doc(db, 'settings', offerId), { text: offerText });
      } else {
        await addDoc(collection(db, 'settings'), { text: offerText });
      }
      alert("Offer updated successfully!");
    } catch (error) {
      console.error("Error updating offer:", error);
      alert("Failed to update offer.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteInquiry = async (id: number) => {
    if (window.confirm("Delete this inquiry?")) {
      try {
        await deleteInquiry(id);
        const data = await getInquiries();
        setInquiries(data);
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-[#1a1a1a] px-6 py-4 border border-white/10 text-center">
            <p className="text-3xl font-black text-[#FF8C00]">{inquiries.length}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-[#708090] mt-1">Total Leads</p>
          </div>
          <div className="bg-[#1a1a1a] px-6 py-4 border border-white/10 text-center">
            <p className="text-3xl font-black text-[#FF8C00]">272+</p>
            <p className="text-xs font-bold uppercase tracking-wider text-[#708090] mt-1">Total Reviews</p>
          </div>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 font-bold uppercase tracking-wider text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Daily Offer Settings */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] p-6 border border-white/10">
            <h4 className="font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-[#FF8C00]">
              <Edit3 className="w-4 h-4" /> Manage Daily Offer
            </h4>
            <textarea
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 p-4 text-sm text-white focus:outline-none focus:border-[#FF8C00] min-h-[120px] mb-4 resize-none"
              placeholder="Enter offer text..."
            />
            <button
              onClick={handleUpdateOffer}
              disabled={updating}
              className="w-full bg-[#FF8C00] text-black font-bold text-sm uppercase tracking-wider py-3 hover:bg-white transition-colors"
            >
              {updating ? 'Saving...' : 'Update Offer'}
            </button>
          </div>
        </div>

        {/* Inquiries Table */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a1a1a] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h4 className="font-bold uppercase tracking-wider flex items-center gap-2 text-[#FF8C00]">
                <Users className="w-4 h-4" /> Member Inquiries
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#121212] text-[#708090] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Interest</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inquiries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#708090] italic">
                        No inquiries found.
                      </td>
                    </tr>
                  ) : (
                    inquiries.map((inq) => (
                      <tr key={inq.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 font-bold">{inq.name}</td>
                        <td className="px-6 py-4 font-mono text-[#FF8C00]">{inq.phone}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">
                            {inq.serviceInterest || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#708090]">
                          {inq.createdAt ? new Date(inq.createdAt).toLocaleDateString() : 'Just now'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteInquiry(inq.id)}
                            className="text-[#708090] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete inquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ChatBot Component ---

function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: string, text: string}[]>([
    {role: 'model', text: 'Hi! I am the DRONACHARYA Gym Assistant. How can I help you today?'}
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatRef.current && process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      chatRef.current = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: "You are a helpful assistant for 'DRONACHARYA The Gym' in Burari, Delhi. You know about their services (Unisex Gym, Crossfit, Aerobics, Strengthening), timings (9:30 AM - 6:30 PM), location (Near Bank of Baroda, Main Burari Road), and pricing (Monthly: ₹1500, 3-Months: ₹4000, Yearly: ₹12000). Be concise, polite, and encourage users to book a free trial."
        }
      });
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatRef.current) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    
    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later or contact us on WhatsApp." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-6 z-50 bg-[#FF8C00] text-black p-4 rounded-full shadow-[0_0_20px_rgba(255,140,0,0.5)] hover:scale-110 transition-transform flex items-center justify-center ${isOpen ? 'hidden' : 'flex'}`}
      >
        <Bot className="w-8 h-8" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-[100] w-[350px] h-[500px] bg-[#1a1a1a] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#FF8C00] text-black p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <span className="font-black uppercase tracking-wider">AI Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-black/10 p-1 rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121212]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 text-sm ${msg.role === 'user' ? 'bg-[#FF8C00] text-black rounded-l-xl rounded-tr-xl font-medium' : 'bg-[#2a2a2a] text-white rounded-r-xl rounded-tl-xl border border-white/5'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 text-sm bg-[#2a2a2a] text-white rounded-r-xl rounded-tl-xl border border-white/5 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-[#1a1a1a] border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-[#121212] border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-[#FF8C00] transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-[#FF8C00] text-black p-2 hover:bg-white transition-colors disabled:opacity-50 disabled:hover:bg-[#FF8C00]"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
