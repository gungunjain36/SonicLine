import { useState, useEffect } from 'react';
import axios from 'axios';

interface CallLog {
  call_sid: string;
  caller: string;
  direction: string;
  status: string;
  start_time: number;
  end_time?: number;
  duration?: number;
  logs: {
    role: string;
    content: string;
    timestamp: number;
  }[];
}

export default function TwilioCalls() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await axios.get('https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app/twilio/calls');
      setCalls(response.data.calls);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching call logs:', err);
      setError('Failed to load call logs. Please try again later.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    
    // Refresh call logs every 30 seconds
    const intervalId = setInterval(fetchCalls, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const viewCallDetails = async (callSid: string) => {
    try {
      const response = await axios.get(`https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app/twilio/call/${callSid}`);
      setSelectedCall(response.data);
    } catch (err) {
      console.error('Error fetching call details:', err);
      setError('Failed to load call details. Please try again later.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Twilio Call Logs</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/2">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Calls</h2>
              <button 
                onClick={fetchCalls}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh
              </button>
            </div>
            
            {loading ? (
              <p className="text-gray-500">Loading call logs...</p>
            ) : calls.length === 0 ? (
              <p className="text-gray-500">No call logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caller</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {calls.map((call) => (
                      <tr key={call.call_sid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{call.caller}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{call.direction}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            call.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            call.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatTime(call.start_time)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button 
                            onClick={() => viewCallDetails(call.call_sid)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-full md:w-1/2">
          {selectedCall ? (
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Call Details</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Caller</p>
                  <p className="font-medium">{selectedCall.caller}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Direction</p>
                  <p className="font-medium capitalize">{selectedCall.direction}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">{selectedCall.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Time</p>
                  <p className="font-medium">{formatTime(selectedCall.start_time)}</p>
                </div>
                {selectedCall.end_time && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">End Time</p>
                      <p className="font-medium">{formatTime(selectedCall.end_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="font-medium">{formatDuration(selectedCall.duration || 0)}</p>
                    </div>
                  </>
                )}
              </div>
              
              <h3 className="text-lg font-semibold mb-2">Conversation</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                {selectedCall.logs.length === 0 ? (
                  <p className="text-gray-500">No conversation logs available.</p>
                ) : (
                  selectedCall.logs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg ${
                        log.role === 'user' ? 'bg-blue-50 ml-8' : 
                        log.role === 'assistant' ? 'bg-gray-50 mr-8' : 
                        'bg-yellow-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold capitalize">{log.role}</span>
                        <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
                      </div>
                      <p className="mt-1">{log.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-4 flex items-center justify-center h-64">
              <p className="text-gray-500">Select a call to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 