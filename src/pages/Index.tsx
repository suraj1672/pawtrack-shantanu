import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dog, Activity, MapPin, Bell, FileText, Shield, Heart, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Activity,
      title: 'Real-Time Health Monitoring',
      description: 'Track heart rate, temperature, and activity levels of your dogs in real-time with smart collar technology.'
    },
    {
      icon: MapPin,
      title: 'GPS Location Tracking',
      description: 'Know exactly where your dogs are at all times with accurate GPS tracking and geofencing alerts.'
    },
    {
      icon: Bell,
      title: 'Instant Alerts',
      description: 'Receive immediate notifications when health vitals are abnormal or when dogs leave designated areas.'
    },
    {
      icon: FileText,
      title: 'Health Reports',
      description: 'Generate comprehensive health reports in PDF format for any time period - daily, weekly, monthly, or yearly.'
    },
    {
      icon: Shield,
      title: 'Medical Records Storage',
      description: 'Store vaccination cards, prescriptions, and medical documents securely for each dog.'
    },
    {
      icon: Heart,
      title: 'Community Support',
      description: 'Connect with other NGOs, share experiences, and get support from the community.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Dog className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl text-foreground">SentriQ</span>
            </Link>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Button asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Smartphone className="h-4 w-4" />
              Smart Collar Technology
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Monitor Your Rescue Dogs with{' '}
              <span className="text-primary">Smart Technology</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              SentriQ helps NGOs track and monitor the health of their rescue dogs in real-time. 
              Get instant alerts, track locations, and maintain comprehensive health records.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link to="/signup">Get Started Free</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Care for Your Dogs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive monitoring and management tools designed specifically for NGOs managing rescue dogs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in just a few simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Create Your NGO Account</h3>
              <p className="text-muted-foreground">Sign up with your NGO details and get instant access to the dashboard.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Add Your Dogs</h3>
              <p className="text-muted-foreground">Register your dogs with their details and connect their smart collars.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Start Monitoring</h3>
              <p className="text-muted-foreground">Track health vitals, location, and receive alerts in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Transform Your Dog Care?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join hundreds of NGOs already using SentriQ to monitor and care for their rescue dogs.
          </p>
          {!isAuthenticated && (
            <Button size="lg" variant="secondary" asChild>
              <Link to="/signup">Create Your Free Account</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Dog className="h-6 w-6 text-primary" />
              <span className="font-bold text-foreground">SentriQ</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 SentriQ. All rights reserved. Made with ❤️ for rescue dogs.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
