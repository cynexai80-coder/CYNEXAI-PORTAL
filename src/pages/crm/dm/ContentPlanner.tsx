import React from 'react';
import { Card } from '../../../components/ui/erp/Card';
import { Button } from '../../../components/ui/erp/Button';
import { Calendar as CalendarIcon, Plus, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ContentPlanner() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0 overflow-y-auto pb-32">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Content Planner</h1>
            <p className="text-erp-text/70 font-medium mt-1">Social Media & Campaign Calendar</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/dm/dashboard')}>Back to Hub</Button>
            <Button className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> New Post
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-8">
          {/* Week Calendar Mockup */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <Card key={day} className={`p-4 text-center ${i === 2 ? 'bg-erp-primary/10 border-erp-primary' : ''}`}>
              <span className="block text-xs font-bold text-erp-text/50 uppercase">{day}</span>
              <span className={`block text-2xl font-bold font-display ${i === 2 ? 'text-erp-primary' : 'text-erp-text'}`}>{14 + i}</span>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-bold font-display text-erp-text mb-4">Scheduled for Today (Wed 16)</h2>
        <div className="space-y-4">
          <Card className="flex items-start gap-4 border-l-4 border-pink-500">
            <div className="bg-pink-100 p-3 rounded-xl text-pink-700 mt-1">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-erp-text">Instagram Reel - React Tips</h3>
                  <p className="text-sm font-bold text-erp-text/50">Platform: Instagram • Type: Video</p>
                </div>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Scheduled 4:00 PM
                </span>
              </div>
              <p className="text-sm text-erp-text/70 mt-2 line-clamp-2">
                "Stop using useEffect for everything! Here are 3 better ways to handle state derivations in React..." #reactjs #webdev
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" className="h-8 text-xs border border-erp-border">Edit</Button>
                <Button className="h-8 text-xs">Publish Now</Button>
              </div>
            </div>
          </Card>
          
          <Card className="flex items-start gap-4 border-l-4 border-blue-500 opacity-70">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600 mt-1">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-erp-text">LinkedIn Post - Student Success</h3>
                  <p className="text-sm font-bold text-erp-text/50">Platform: LinkedIn • Type: Image + Text</p>
                </div>
                <span className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-white px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Published 10:00 AM
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
