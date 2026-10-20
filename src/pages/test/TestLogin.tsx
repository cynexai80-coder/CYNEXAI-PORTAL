import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '../../lib/feedback';

export default function TestLogin() {
  const [fullName, setFullName] = useState('');
  const [batch, setBatch] = useState('1');
  const navigate = useNavigate();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      notify("Please enter your full name");
      return;
    }
    
    // Store in session storage for the attempt page
    sessionStorage.setItem('test_student_name', fullName);
    sessionStorage.setItem('test_batch', batch);
    
    navigate('/test/attempt');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          SQL Assessment Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Official testing environment
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleStart}>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your full name as per records"
                />
              </div>
            </div>

            <div>
              <label htmlFor="batch" className="block text-sm font-medium text-gray-700">
                Batch
              </label>
              <div className="mt-1">
                <select
                  id="batch"
                  name="batch"
                  value={batch}
                  onChange={e => setBatch(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="1">Batch 1</option>
                  <option value="2">Batch 2</option>
                  <option value="3">Batch 3</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Start Test
              </button>
            </div>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Important Instructions</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500 space-y-2">
              <p>• Test is timed. Do not refresh the page.</p>
              <p>• All questions are mandatory.</p>
              <p>• SQL Queries will be evaluated manually.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
