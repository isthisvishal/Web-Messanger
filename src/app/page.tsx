import Link from "next/link";
import { Shield, Lock, Key, Fingerprint, Mail, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen animated-gradient">

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <nav className="relative z-10 max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold gradient-text">Web Messenger</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
              Get Started
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-8">
            <Lock className="w-4 h-4" />
            Zero-Knowledge End-to-End Encryption
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            <span className="gradient-text">Messages only</span>
            <br />
            <span className="text-foreground">you can read</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Web Messenger uses zero-knowledge architecture. All encryption happens in your browser.
            The server never sees your messages — even we can&apos;t read them.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 glow-primary">
              Start Messaging Securely
            </Link>
            <Link href="https://github.com/isthisvishal/Web-Messanger" className="px-8 py-3.5 rounded-xl border border-border text-foreground font-medium hover:bg-accent transition-all">
              View on GitHub
            </Link>
          </div>
        </div>
      </div>


      <div className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Enterprise-Grade Security</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Lock, title: "AES-256-GCM", desc: "Military-grade encryption for every message. Fresh nonce per message, no key reuse." },
            { icon: Key, title: "ECDH P-256", desc: "Elliptic curve key agreement between users. Your private key never leaves your device." },
            { icon: Fingerprint, title: "Passkeys", desc: "WebAuthn biometric authentication. No passwords to steal, phishing-resistant." },
            { icon: Mail, title: "2FA Required", desc: "Every login requires OTP verification. Codes are bcrypt-hashed, never stored in plaintext." },
            { icon: Shield, title: "Zero Knowledge", desc: "Server stores only ciphertext. Even a full database breach reveals nothing readable." },
            { icon: Users, title: "Admin Panel", desc: "Full user management, SMTP configuration, email templates, and audit logging." },
          ].map((f, i) => (
            <div key={i} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>


      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Web Messenger. Open source under MIT License.</p>
          <div className="flex items-center gap-1"><Lock className="w-3 h-3" /> Zero-knowledge by design</div>
        </div>
      </footer>
    </div>
  );
}
