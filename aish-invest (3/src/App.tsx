import React, { useState, useEffect } from 'react';
import {
  Mail, MapPin, MessageCircle, Shield, HeartPulse,
  Bike, Car, TrendingUp, CheckCircle, Clock, Users, Star,
  ThumbsUp, ChevronDown, Menu, X, ArrowRight, FileText,
  Search, CheckSquare, ChevronUp, Calendar, User, ArrowLeft,
  ShieldCheck, Award, Briefcase, ChevronRight, LogIn, LogOut
} from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import AIAssistant from './components/AIAssistant';
import AskAIAssistantSection from './components/AskAIAssistantSection';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Form State
  const [serviceType, setServiceType] = useState('Claim Support');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoginLoading(true);
      setLoginError('');
      const result = await signInWithPopup(auth, googleProvider);
      const loggedInUser = result.user;
      
      // Save user details securely in the database
      try {
        await setDoc(doc(db, 'users', loggedInUser.uid), {
          uid: loggedInUser.uid,
          displayName: loggedInUser.displayName,
          email: loggedInUser.email,
          photoURL: loggedInUser.photoURL,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${loggedInUser.uid}`);
      }
      setShowLoginModal(false);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // Ignore user closing the popup
        setIsLoginLoading(false);
        return;
      }
      
      try {
        const parsedError = JSON.parse(error.message);
        if (parsedError.error?.includes('Missing or insufficient permissions')) {
          alert("Login successful, but we couldn't save your profile to the database due to missing permissions. Please update your Firestore Security Rules.");
          setShowLoginModal(false);
          return;
        }
      } catch (e) {
        // Not a JSON error, continue to normal error handling
      }

      console.error("Login failed", error);
      setLoginError("Google Login failed. Please try again.");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password.");
      return;
    }
    
    setIsLoginLoading(true);
    setLoginError('');
    
    try {
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const loggedInUser = result.user;
      
      try {
        await setDoc(doc(db, 'users', loggedInUser.uid), {
          uid: loggedInUser.uid,
          displayName: loggedInUser.displayName || loginEmail.split('@')[0],
          email: loggedInUser.email,
          lastLogin: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${loggedInUser.uid}`);
      }
      setShowLoginModal(false);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        // Firebase now uses invalid-credential for both wrong password and user not found.
        // Let's try to create the account. If it fails with email-already-in-use, it means the password was just wrong.
        try {
          const result = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
          const loggedInUser = result.user;
          try {
            await setDoc(doc(db, 'users', loggedInUser.uid), {
              uid: loggedInUser.uid,
              displayName: loginEmail.split('@')[0],
              email: loggedInUser.email,
              lastLogin: serverTimestamp()
            }, { merge: true });
          } catch (dbError) {
             handleFirestoreError(dbError, OperationType.WRITE, `users/${loggedInUser.uid}`);
          }
          setShowLoginModal(false);
        } catch (signUpError: any) {
          if (signUpError.code === 'auth/email-already-in-use') {
            setLoginError("Invalid email or password. Please try again.");
          } else if (signUpError.code === 'auth/weak-password') {
            setLoginError("Password is too weak. It should be at least 6 characters.");
          } else if (signUpError.code === 'auth/operation-not-allowed') {
            setLoginError("Email/Password login is not enabled in your Firebase Console.");
          } else {
            setLoginError(signUpError.message || "Failed to create account.");
          }
        }
      } else if (error.code === 'auth/operation-not-allowed') {
        setLoginError("Email/Password login is not enabled in your Firebase Console.");
      } else {
        setLoginError("Login failed. Please check your credentials.");
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      handleLogin();
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'serviceRequests'), {
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        serviceType,
        message,
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      setSubmitSuccess(true);
      setMessage('');
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error: any) {
      if (error?.message?.includes('Missing or insufficient permissions') || error?.code === 'permission-denied') {
        alert("Permission denied: Please update your Firestore Security Rules to allow writing to 'serviceRequests'.");
      } else {
        alert("Failed to submit request. Please try again.");
      }
      handleFirestoreError(error, OperationType.CREATE, 'serviceRequests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailAddress = "aish8512@gmail.com";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About Us', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Claim Help', href: '#claim' },
    { name: 'LIC Plans', href: '#lic-plans' },
    { name: 'Request Assistance', href: '#request-assistance' },
    { name: 'Why Us', href: '#why-us' },
    { name: 'Blog', href: '#blog' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Contact Us', href: '#contact-form' },
  ];

  const services = [
    { title: 'LIC Insurance', icon: <ShieldCheck className="w-10 h-10 text-secondary" />, desc: 'Secure your family\'s future with trusted Life Insurance Corporation plans tailored to your long-term financial goals.' },
    { title: 'Health Insurance', icon: <HeartPulse className="w-10 h-10 text-secondary" />, desc: 'Comprehensive medical coverage to protect your savings from unexpected hospitalization and healthcare costs.' },
    { title: 'Bike Insurance', icon: <Bike className="w-10 h-10 text-secondary" />, desc: 'Mandatory third-party and comprehensive covers to protect your two-wheeler against accidents and theft.' },
    { title: 'Car Insurance', icon: <Car className="w-10 h-10 text-secondary" />, desc: 'Complete protection for your four-wheeler against damages, natural disasters, and third-party liabilities.' },
    { title: 'Mutual Funds', icon: <TrendingUp className="w-10 h-10 text-secondary" />, desc: 'Expert guidance on SIPs and lump-sum investments to build wealth and beat inflation over time.' },
  ];

  const claimSteps = [
    { title: 'Policy Check & Consultation', icon: <Search className="w-6 h-6" />, desc: 'We review your policy details, coverage limits, and the nature of your claim to ensure eligibility.' },
    { title: 'Document Collection', icon: <FileText className="w-6 h-6" />, desc: 'We help you gather all necessary documents, including FIRs, medical bills, or repair estimates.' },
    { title: 'Claim Submission', icon: <CheckSquare className="w-6 h-6" />, desc: 'Our team formally submits the claim to the insurance company on your behalf, ensuring zero errors.' },
    { title: 'Verification & Follow-up', icon: <Clock className="w-6 h-6" />, desc: 'We continuously follow up with the surveyor and insurance company during the verification process.' },
    { title: 'Final Approval & Settlement', icon: <CheckCircle className="w-6 h-6" />, desc: 'The claim amount is approved and directly settled to your bank account or the network hospital/garage.' },
  ];

  const whyChooseUs = [
    { title: 'Expert Guidance', icon: <Award className="w-8 h-8 text-secondary" />, desc: 'Years of experience in the insurance sector ensuring you get the best advice.' },
    { title: 'Hassle-Free Claims', icon: <Shield className="w-8 h-8 text-secondary" />, desc: 'We stand by you during emergencies to ensure your claims are passed quickly.' },
    { title: 'Unbiased Advice', icon: <Briefcase className="w-8 h-8 text-secondary" />, desc: 'We recommend products that suit YOUR needs, not just what pays the highest commission.' },
    { title: 'Local Trust', icon: <MapPin className="w-8 h-8 text-secondary" />, desc: 'A trusted name in Kanpur Nagar, serving hundreds of satisfied families.' },
    { title: 'Email Support', icon: <Mail className="w-8 h-8 text-secondary" />, desc: 'Always available via email to answer your urgent queries.' },
    { title: 'Complete Portfolio', icon: <TrendingUp className="w-8 h-8 text-secondary" />, desc: 'From life cover to wealth creation, manage all your finances under one roof.' },
  ];

  const faqs = [
    { q: 'Which insurance policy is best for me?', a: 'The "best" policy depends entirely on your age, income, family dependents, and financial goals. We provide a free consultation to analyze your needs and recommend the perfect fit.' },
    { q: 'How can you help with old policy issues?', a: 'If you have a lapsed policy, incorrect details, or are facing issues with an existing agent, we can take over the servicing and help resolve your grievances with the insurance company.' },
    { q: 'How long does a typical claim take to settle?', a: 'Health and motor cashless claims are usually approved within 2-4 hours. Reimbursement and life insurance claims can take anywhere from 7 to 30 days depending on document verification.' },
    { q: 'Are Mutual Funds safe for beginners?', a: 'While subject to market risks, Mutual Funds are highly regulated by SEBI. For beginners, we recommend starting with low-risk Index Funds or SIPs to average out market volatility.' },
    { q: 'Do you charge a fee for consultation?', a: 'No, our initial consultation and portfolio review are completely free of charge. We earn our revenue directly from the financial institutions when you choose to invest or insure through us.' },
  ];

  const blogPosts = [
    {
      id: 1,
      title: "5 Reasons Why Health Insurance is a Must in 2024",
      date: "October 15, 2023",
      excerpt: "Medical emergencies can happen anytime. Learn why having a comprehensive health insurance policy is your best defense against rising medical costs.",
      content: "Aaj ke daur mein medical expenses tezi se badh rahe hain. Ek choti si bimari bhi aapki saari savings khatam kar sakti hai. Isliye health insurance hona bahut zaroori hai.\n\n1. Financial Security: Hospitalization ke waqt cash ki tension nahi hoti.\n2. Cashless Treatment: Network hospitals mein bina cash diye ilaaj.\n3. Tax Benefits: Section 80D ke tahat tax mein chhoot.\n4. Peace of Mind: Bimari ke waqt sirf recovery par focus karein, kharche par nahi.\n\nSahi health insurance chunne ke liye aaj hi humse sampark karein.",
      imageUrl: "https://picsum.photos/seed/health/800/400",
      author: "Aish Mohammad Siddiqui",
      readTime: "4 min read"
    },
    {
      id: 2,
      title: "Mutual Funds vs FD: Kahan Invest Karein?",
      date: "November 02, 2023",
      excerpt: "Confused between Fixed Deposits and Mutual Funds? Understand the risks and returns to make the right investment choice for your future.",
      content: "Fixed Deposit (FD) aur Mutual Funds dono hi investment ke popular options hain, par dono ke apne fayde aur nuksan hain.\n\nFD mein aapko guaranteed return milta hai, par inflation (mehangai) ko beat karna mushkil hota hai. Dusri taraf, Mutual Funds market se linked hote hain, isliye risk thoda zyada hota hai, par long term mein returns FD se kahin behtar milte hain.\n\nAgar aap long term wealth create karna chahte hain, toh SIP ke zariye Mutual Funds mein invest karna ek smart choice hai. Hum aapki risk appetite ke hisaab se best funds suggest kar sakte hain.",
      imageUrl: "https://picsum.photos/seed/investment/800/400",
      author: "Aish Mohammad Siddiqui",
      readTime: "5 min read"
    },
    {
      id: 3,
      title: "Car Insurance Claim Rejection Se Kaise Bachein?",
      date: "November 20, 2023",
      excerpt: "Don't let your car insurance claim get rejected. Follow these simple tips to ensure a smooth and hassle-free claim settlement process.",
      content: "Car accident ke baad claim reject hona bahut pareshani ka kaaran ban sakta hai. In baaton ka dhyan rakhein:\n\n1. Turant Inform Karein: Accident ke 24-48 ghante ke andar insurance company ko inform karein.\n2. FIR Zaroori Hai: Chori ya major accident ke case mein police FIR zaroori hoti hai.\n3. Sahi Jankari Dein: Claim form mein koi bhi galat jankari na bharein.\n4. Evidence Rakhein: Accident spot aur damage ki photos/videos zaroor lein.\n\nAgar aapko claim process mein koi madad chahiye, toh AISH INVEST hamesha aapke saath hai.",
      imageUrl: "https://picsum.photos/seed/car/800/400",
      author: "Aish Mohammad Siddiqui",
      readTime: "3 min read"
    }
  ];

  return (
    <div className="min-h-screen bg-bg-light font-sans text-text-dark selection:bg-secondary selection:text-white">
      
      {/* Header / Navigation */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-3' : 'bg-white/90 backdrop-blur-md py-5 border-b border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 md:w-12 md:h-12 drop-shadow-sm">
              <path d="M12 2.5L4 6v5.5c0 5.08 3.4 9.85 8 11 4.6-1.15 8-5.92 8-11V6l-8-3.5z" fill="#203b73" stroke="#3b5a9d" strokeWidth="1" strokeLinejoin="round"/>
              <path d="M7 15l4-4 2 2 5-5" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 8h5v5" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="flex flex-col justify-center">
              <span className="text-2xl md:text-3xl font-extrabold text-[#203b73] tracking-tight leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>AISH INVEST</span>
              <span className="text-[9px] md:text-[11px] font-bold text-[#d97706] tracking-[0.15em] mt-1 leading-none">INSURANCE &amp; INVESTMENT</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="text-sm font-semibold text-text-light hover:text-secondary transition-colors">
                {link.name}
              </a>
            ))}
          </nav>

          {/* CTA & Mobile Toggle */}
          <div className="flex items-center gap-4">
            <a href={`mailto:${emailAddress}`} className="hidden md:flex items-center gap-2 text-primary font-bold hover:text-secondary transition-colors">
              <Mail className="w-5 h-5" />
              <span>Contact Us</span>
            </a>
            
            {isAuthReady && (
              user ? (
                <div className="hidden md:flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                    <span className="text-sm font-semibold text-primary max-w-[100px] truncate">{user.displayName?.split(' ')[0]}</span>
                  </div>
                  <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 transition-colors" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={handleLogin} className="hidden md:flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg font-bold hover:bg-secondary/90 transition-colors text-sm">
                  <LogIn className="w-4 h-4" /> Login
                </button>
              )
            )}

            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden text-primary p-2">
              {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-slate-100 py-4 px-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-4 py-3 text-base font-semibold text-text-dark hover:bg-accent hover:text-secondary rounded-lg transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="mt-4 pt-4 border-t border-slate-100 px-4 flex flex-col gap-3">
              {isAuthReady && (
                user ? (
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-8 h-8 text-primary bg-white rounded-full p-1" />
                      )}
                      <span className="font-semibold text-primary">{user.displayName}</span>
                    </div>
                    <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 p-2">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={handleLogin} className="flex items-center justify-center gap-2 w-full bg-secondary text-white py-3 rounded-lg font-bold">
                    <LogIn className="w-5 h-5" /> Login / Sign Up
                  </button>
                )
              )}
              <a href={`mailto:${emailAddress}`} className="flex items-center justify-center gap-2 w-full bg-accent text-primary py-3 rounded-lg font-bold">
                <Mail className="w-5 h-5" /> Email Us
              </a>
            </div>
          </div>
        )}
      </header>

      {/* 1. Hero Section */}
      <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-gradient-to-br from-blue-50 via-white to-blue-100 overflow-hidden min-h-[90vh] flex items-center">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-blue-200/50 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-blue-100/60 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Text Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 text-secondary text-sm font-bold mb-8 shadow-sm">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                IRDAI Compliant Guidance
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary leading-tight mb-6 tracking-tight">
                Struggling with Insurance Claims or Policies?
              </h1>
              
              <p className="text-xl md:text-2xl text-text-light mb-6 font-medium leading-relaxed">
                We Help You Fix Old Policies, Claim Issues & Loan Problems – <span className="text-secondary font-bold">Fast & Hassle-Free.</span>
              </p>

              <div className="flex items-center justify-center lg:justify-start gap-3 mb-10 text-base md:text-lg text-slate-700 font-medium bg-white/60 w-fit mx-auto lg:mx-0 px-5 py-3 rounded-xl border border-blue-100/50 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-green-500 flex-shrink-0" />
                <span className="text-left">Trusted support for LIC, Health, Vehicle Insurance & Mutual Funds.</span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                <a href="#request-assistance" className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transform hover:-translate-y-1">
                  Get Help Now <ArrowRight className="w-5 h-5" />
                </a>
                <a href={`mailto:${emailAddress}`} className="w-full sm:w-auto bg-secondary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/30 flex items-center justify-center gap-2 transform hover:-translate-y-1">
                  <Mail className="w-5 h-5" /> Contact via Email
                </a>
              </div>
            </div>

            {/* Right Column: Image */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-full lg:ml-auto mt-10 lg:mt-0">
              {/* Decorative elements behind image */}
              <div className="absolute inset-0 bg-gradient-to-tr from-secondary to-primary rounded-[2rem] transform rotate-3 scale-105 opacity-10 blur-lg"></div>
              <div className="absolute -inset-4 border-2 border-dashed border-blue-200 rounded-[2.5rem] animate-[spin_60s_linear_infinite]"></div>
              
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/20 border-4 border-white group">
                <img 
                  src="/profile.jpg" 
                  alt="Aish Mohammad Siddiqui - Insurance Advisor" 
                  className="w-full h-[400px] lg:h-[550px] object-cover object-top transform group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                
                {/* Floating Trust Badge */}
                <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/50 flex items-center gap-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="font-bold text-primary text-lg">27+ Years Experience</div>
                    <div className="text-sm text-text-light font-medium">Trusted by thousands of families</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. About Section */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              {/* Image Placeholder / Graphic */}
              <div className="aspect-[4/3] rounded-2xl bg-accent p-8 relative overflow-hidden shadow-inner border border-blue-100">
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/office/800/600')] opacity-20 mix-blend-overlay object-cover"></div>
                <div className="relative h-full flex flex-col justify-center">
                  <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm transform -rotate-2">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                        <Shield className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">Aish Mohammad Siddiqui</h4>
                        <p className="text-sm text-text-light">Founder & Lead Advisor</p>
                      </div>
                    </div>
                    <p className="text-sm text-text-light italic">"Our mission is to bring transparency and trust to every Indian household's financial planning."</p>
                  </div>
                  <div className="bg-primary text-white p-6 rounded-xl shadow-xl max-w-xs self-end transform translate-y-8 rotate-2">
                    <div className="text-3xl font-bold mb-1">27+</div>
                    <div className="text-sm text-blue-200">Years of Trust & Excellence in Kanpur Nagar</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
                <div className="w-8 h-1 bg-secondary rounded-full"></div>
                About Aish Invest
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-6 leading-tight">
                Guiding You Towards a Secure Financial Future
              </h2>
              <p className="text-lg text-text-light mb-6 leading-relaxed">
                At AISH INVEST, we believe that insurance and investments are not just financial products; they are promises made to your loved ones. Based in Kanpur Nagar, we have dedicated ourselves to simplifying complex financial decisions for our clients.
              </p>
              <p className="text-lg text-text-light mb-8 leading-relaxed">
                Whether you are struggling with an old policy issue, facing a delayed claim, or looking to start your wealth creation journey through Mutual Funds, our expert team provides transparent, unbiased, and highly personalized guidance.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-lg">Trust First</h4>
                    <p className="text-sm text-text-light mt-1">We prioritize your needs over commissions.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-lg">Expert Guidance</h4>
                    <p className="text-sm text-text-light mt-1">Professional advice for every life stage.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Services Section */}
      <section id="services" className="py-24 bg-bg-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
              Our Services
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6">Comprehensive Solutions</h2>
            <p className="text-lg text-text-light">Protecting your assets and growing your wealth with industry-leading products.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mb-6 group-hover:bg-secondary group-hover:text-white transition-colors">
                  {React.cloneElement(service.icon, { className: 'w-10 h-10 text-secondary group-hover:text-white transition-colors' })}
                </div>
                <h3 className="text-2xl font-bold text-primary mb-4">{service.title}</h3>
                <p className="text-text-light leading-relaxed mb-6">{service.desc}</p>
                <a href={`mailto:${emailAddress}`} className="inline-flex items-center gap-2 text-secondary font-bold hover:text-primary transition-colors">
                  Inquire Now <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Claim Help Section */}
      <section id="claim" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
                <div className="w-8 h-1 bg-secondary rounded-full"></div>
                Claim Assistance
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6 leading-tight">
                Stress-Free Claim Settlement Process
              </h2>
              <p className="text-lg text-text-light mb-10 leading-relaxed">
                Facing a medical emergency or an accident is stressful enough. You shouldn't have to fight for your rightful claim. Our dedicated team handles the paperwork so you can focus on what matters.
              </p>
              
              <div className="bg-accent rounded-2xl p-8 border border-blue-100">
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Mail className="w-6 h-6 text-secondary" /> Need Urgent Claim Help?
                </h3>
                <p className="text-text-light mb-6">Don't wait. Contact us immediately after an incident for the best chance of a smooth approval.</p>
                <a href={`mailto:${emailAddress}`} className="w-full bg-primary text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md">
                  Email Emergency Support
                </a>
              </div>
            </div>

            {/* Vertical Timeline */}
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-[27px] top-4 bottom-4 w-1 bg-accent rounded-full"></div>
              
              <div className="space-y-8 relative">
                {claimSteps.map((step, index) => (
                  <div key={index} className="flex gap-6 relative group">
                    <div className="w-14 h-14 rounded-full bg-white border-4 border-accent flex items-center justify-center flex-shrink-0 z-10 group-hover:border-secondary transition-colors shadow-sm">
                      <span className="text-primary font-bold">{index + 1}</span>
                    </div>
                    <div className="pt-3 pb-4">
                      <h4 className="text-xl font-bold text-primary mb-2 flex items-center gap-2">
                        {step.title}
                      </h4>
                      <p className="text-text-light leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIC Insurance Plans Section */}
      <section id="lic-plans" className="py-24 bg-bg-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
              LIC Insurance Plans
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6 leading-tight">
              Choose the best plan for your future security
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "LIC Jeevan Anand",
                desc: "A combination of whole life and endowment assurance plan.",
                benefits: ["Lifelong risk cover", "Maturity benefit with bonus", "Loan facility available"],
                img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              },
              {
                name: "LIC Jeevan Umang",
                desc: "A non-linked, participating, individual, life assurance savings plan.",
                benefits: ["8% of Sum Assured every year", "Life cover till age 100", "Tax benefits under 80C & 10(10D)"],
                img: "https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              },
              {
                name: "LIC Tech Term Plan",
                desc: "A pure protection online term assurance policy.",
                benefits: ["High life cover at low premium", "Flexible premium payment options", "Special rates for non-smokers"],
                img: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              },
              {
                name: "LIC Jeevan Labh",
                desc: "A limited premium paying, non-linked, with-profits endowment plan.",
                benefits: ["Pay premium for limited period", "Maturity benefit with bonuses", "Ideal for planning child's education"],
                img: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              },
              {
                name: "LIC New Endowment Plan",
                desc: "A participating non-linked plan which offers an attractive combination of protection and saving features.",
                benefits: ["Financial support for family", "Good returns on maturity", "Loan facility for liquidity needs"],
                img: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              }
            ].map((plan, index) => (
              <div key={index} className="bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-2xl transition-all group flex flex-col">
                <div className="h-48 overflow-hidden relative">
                  <img src={plan.img} alt={plan.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
                  <h3 className="absolute bottom-4 left-6 text-2xl font-bold text-white">{plan.name}</h3>
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <p className="text-text-light mb-6">{plan.desc}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <CheckCircle className="w-5 h-5 text-secondary shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { plan: plan.name } }))}
                    className="w-full bg-blue-50 text-primary py-3 rounded-xl font-bold text-center hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    Get Details <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ask AI Assistant Section */}
      <AskAIAssistantSection emailAddress={emailAddress} />

      {/* Request Assistance Form Section */}
      <section id="request-assistance" className="py-24 bg-blue-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-blue-100">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-4">Request Assistance</h2>
              <p className="text-text-light text-lg">Need help with a claim or policy? Fill out the form below and our team will get back to you shortly.</p>
            </div>

            {!user ? (
              <div className="text-center py-8 bg-blue-50/50 rounded-2xl border border-blue-100">
                <ShieldCheck className="w-16 h-16 text-secondary mx-auto mb-4 opacity-80" />
                <h3 className="text-xl font-bold text-primary mb-2">Login Required</h3>
                <p className="text-text-light mb-6 max-w-md mx-auto">Please sign in to your account to submit a service request securely.</p>
                <button 
                  onClick={handleLogin}
                  className="bg-secondary text-white px-8 py-3 rounded-xl font-bold hover:bg-secondary/90 transition-colors shadow-lg shadow-secondary/20 flex items-center gap-2 mx-auto"
                >
                  <LogIn className="w-5 h-5" /> Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-6">
                {submitSuccess && (
                  <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 border border-green-200">
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="font-medium">Your request has been submitted successfully! We will contact you soon.</p>
                  </div>
                )}
                
                <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-10 h-10 text-primary bg-white rounded-full p-2" />
                  )}
                  <div>
                    <p className="text-sm text-text-light">Requesting as</p>
                    <p className="font-bold text-primary">{user.displayName}</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="serviceType" className="block text-sm font-bold text-primary mb-2">What do you need help with?</label>
                  <select 
                    id="serviceType"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-slate-50"
                    required
                  >
                    <option value="Claim Support">Claim Support</option>
                    <option value="Policy Renewal">Policy Renewal</option>
                    <option value="New Insurance Policy">New Insurance Policy</option>
                    <option value="Mutual Fund Investment">Mutual Fund Investment</option>
                    <option value="Other Query">Other Query</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-bold text-primary mb-2">Additional Details</label>
                  <textarea 
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Please provide policy number or explain your issue briefly..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-slate-50 resize-none"
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Submitting...</span>
                  ) : (
                    <>Submit Request <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 5. Why Choose Us */}
      <section id="why-us" className="py-24 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 text-blue-300 font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-blue-300 rounded-full"></div>
              The Aish Invest Advantage
              <div className="w-8 h-1 bg-blue-300 rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Why Choose Us?</h2>
            <p className="text-lg text-blue-100">We don't just sell policies; we build lifelong relationships based on trust and performance.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {whyChooseUs.map((feature, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/10 p-8 rounded-2xl hover:bg-white/20 transition-colors">
                <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                  {React.cloneElement(feature.icon, { className: 'w-8 h-8 text-blue-300' })}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-blue-100 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="py-24 bg-bg-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
              Knowledge Hub
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6">Latest Updates & Tips</h2>
            <p className="text-lg text-text-light">Stay informed with our expert insights on insurance and wealth management.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 flex flex-col group cursor-pointer" onClick={() => setSelectedPost(post)}>
                <div className="overflow-hidden relative">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {post.date}
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-primary mb-4 line-clamp-2 group-hover:text-secondary transition-colors">{post.title}</h3>
                  <p className="text-text-light mb-6 line-clamp-3 flex-grow leading-relaxed">{post.excerpt}</p>
                  <div className="text-secondary font-bold flex items-center gap-2 mt-auto">
                    Read Full Article <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
              Got Questions?
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-8 py-6 text-left flex justify-between items-center bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-lg text-primary pr-4">{faq.q}</span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${openFaqIndex === index ? 'bg-secondary text-white' : 'bg-accent text-secondary'}`}>
                    {openFaqIndex === index ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                {openFaqIndex === index && (
                  <div className="px-8 pb-6 bg-white text-text-light leading-relaxed border-t border-slate-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
              Get In Touch
              <div className="w-8 h-1 bg-secondary rounded-full"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6">Contact Us</h2>
            <p className="text-lg text-text-light">For any insurance assistance, claims, or policy support, please contact us via email.</p>
          </div>

          <div className="bg-blue-50 rounded-3xl p-8 md:p-12 shadow-lg border border-blue-100">
            {contactSuccess && (
              <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium">Your email is ready to send! Please check your email client.</p>
              </div>
            )}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name');
                const email = formData.get('email');
                const subject = formData.get('subject');
                const message = formData.get('message');
                const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject as string)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
                window.location.href = mailtoLink;
                setContactSuccess(true);
                setTimeout(() => setContactSuccess(false), 5000);
              }}
              className="space-y-6"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold text-primary mb-2">Full Name</label>
                  <input type="text" id="name" name="name" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all" placeholder="John Doe" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-primary mb-2">Email Address</label>
                  <input type="email" id="email" name="email" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all" placeholder="john@example.com" />
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-bold text-primary mb-2">Subject</label>
                <input type="text" id="subject" name="subject" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all" placeholder="How can we help you?" />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-bold text-primary mb-2">Message</label>
                <textarea id="message" name="message" required rows={5} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all resize-none" placeholder="Please describe your query in detail..."></textarea>
              </div>
              <button type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" /> Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 7. Footer / Contact Section */}
      <footer id="contact" className="bg-primary pt-24 pb-12 text-white border-t-[12px] border-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Top Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <div className="inline-flex items-center gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 drop-shadow-sm">
                  <path d="M12 2.5L4 6v5.5c0 5.08 3.4 9.85 8 11 4.6-1.15 8-5.92 8-11V6l-8-3.5z" fill="#203b73" stroke="#3b5a9d" strokeWidth="1" strokeLinejoin="round"/>
                  <path d="M7 15l4-4 2 2 5-5" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 8h5v5" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="flex flex-col justify-center">
                  <span className="text-2xl font-extrabold text-[#203b73] tracking-tight leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>AISH INVEST</span>
                  <span className="text-[9px] font-bold text-[#d97706] tracking-[0.15em] mt-1 leading-none">INSURANCE &amp; INVESTMENT</span>
                </div>
              </div>
              <p className="text-blue-200 mb-6 leading-relaxed">
                Your Trusted Partner for Insurance & Investment Solutions in Kanpur Nagar. We secure your today and grow your tomorrow.
              </p>
              <div className="flex gap-4">
                {/* Social Placeholders if needed */}
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-secondary cursor-pointer transition-colors"><MessageCircle className="w-5 h-5" /></div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-secondary cursor-pointer transition-colors"><Mail className="w-5 h-5" /></div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-bold mb-6 border-b border-white/20 pb-2 inline-block">Quick Links</h4>
              <ul className="space-y-4">
                {navLinks.map(link => (
                  <li key={link.name}>
                    <a href={link.href} className="text-blue-200 hover:text-white hover:translate-x-2 transition-all inline-flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-secondary" /> {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-lg font-bold mb-6 border-b border-white/20 pb-2 inline-block">Our Services</h4>
              <ul className="space-y-4">
                <li><a href="#services" className="text-blue-200 hover:text-white transition-colors">LIC Insurance</a></li>
                <li><a href="#services" className="text-blue-200 hover:text-white transition-colors">Health Insurance</a></li>
                <li><a href="#services" className="text-blue-200 hover:text-white transition-colors">Motor Insurance</a></li>
                <li><a href="#services" className="text-blue-200 hover:text-white transition-colors">Mutual Funds</a></li>
                <li><a href="#claim" className="text-blue-200 hover:text-white transition-colors">Claim Settlement</a></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-lg font-bold mb-6 border-b border-white/20 pb-2 inline-block">Contact Us</h4>
              <p className="text-blue-200 mb-6 text-sm">For any insurance assistance, claims, or policy support, please contact us via email.</p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <User className="w-6 h-6 text-secondary flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white mb-1">Admin</strong>
                    <span className="text-blue-200">Aish Mohammad Siddiqui</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <Mail className="w-6 h-6 text-secondary flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white mb-1">Email</strong>
                    <a href={`mailto:${emailAddress}`} className="text-blue-200 hover:text-white transition-colors">{emailAddress}</a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-secondary flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white mb-1">Location</strong>
                    <span className="text-blue-200">Kanpur Nagar, Uttar Pradesh, India</span>
                  </div>
                </li>
              </ul>
            </div>

          </div>

          {/* CTA Banner inside Footer */}
          <div className="bg-gradient-to-r from-secondary to-blue-600 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-12 shadow-2xl">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-2">Ready to secure your future?</h3>
              <p className="text-blue-100 text-lg">Get in touch with Aish Mohammad Siddiqui today.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <a href={`mailto:${emailAddress}`} className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-center hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" /> Send Email
              </a>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-blue-300">
            <p>© {new Date().getFullYear()} AISH INVEST. All rights reserved. Owned by Aish Mohammad Siddiqui.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Email Button */}
      <a
        href={`mailto:${emailAddress}`}
        className="fixed bottom-28 right-6 z-50 bg-secondary hover:bg-secondary/90 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-secondary/40 transition-transform hover:scale-110 hover:-translate-y-1"
        aria-label="Contact via Email"
      >
        <Mail className="w-8 h-8" />
      </a>

      {/* AI Assistant */}
      <AIAssistant />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold text-primary">Welcome Back</h2>
              <p className="text-text-light mt-2">Sign in to manage your requests</p>
            </div>

            {loginError && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {loginError}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">Email</label>
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-2">Password</label>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isLoginLoading}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoginLoading ? 'Signing in...' : 'Login with Email'}
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or continue with</span>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={isLoginLoading}
              className="w-full bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <p className="text-center text-xs text-slate-500 mt-6">
              Note: To use Email Login, ensure "Email/Password" provider is enabled in your Firebase Console.
            </p>
          </div>
        </div>
      )}

      {/* Individual Blog Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <button 
              onClick={() => setSelectedPost(null)}
              className="flex items-center gap-2 text-text-light hover:text-primary font-bold mb-8 transition-colors text-sm tracking-wider uppercase bg-accent px-4 py-2 rounded-full w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Articles
            </button>
            
            <article>
              <h1 className="text-3xl md:text-5xl font-extrabold text-primary mb-6 leading-tight">
                {selectedPost.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-sm text-text-light mb-8 font-medium border-y border-slate-100 py-4">
                <span className="flex items-center gap-2 text-primary font-bold"><User className="w-4 h-4 text-secondary" /> {selectedPost.author}</span>
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-secondary" /> {selectedPost.date}</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-secondary" /> {selectedPost.readTime}</span>
              </div>
              
              <img 
                src={selectedPost.imageUrl} 
                alt={selectedPost.title} 
                className="w-full h-[300px] md:h-[500px] object-cover rounded-3xl mb-12 shadow-lg"
                referrerPolicy="no-referrer"
              />
              
              <div className="prose prose-lg prose-blue max-w-none text-text-light">
                {selectedPost.content.split('\n').map((paragraph: string, idx: number) => (
                  <p key={idx} className="mb-6 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
              
              <div className="mt-16 pt-10 border-t border-slate-200 bg-accent p-8 md:p-12 rounded-3xl text-center">
                <h3 className="text-2xl font-bold text-primary mb-4">Need personalized advice?</h3>
                <p className="text-text-light mb-8 max-w-2xl mx-auto">Contact us today to discuss your insurance and investment needs. Our expert team is ready to help you make the right choice.</p>
                <a 
                  href={`mailto:${emailAddress}`} 
                  className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 rounded-xl font-bold hover:bg-secondary/90 transition-colors shadow-lg shadow-secondary/20"
                >
                  <Mail className="w-5 h-5" />
                  Contact via Email
                </a>
              </div>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
