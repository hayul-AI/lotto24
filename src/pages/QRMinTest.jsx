import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const QRMinTest = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [lastDecodedText, setLastDecodedText] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Standby');
  const [videoDim, setVideoDim] = useState({ w: 0, h: 0 });
  const [cameraLabel, setCameraLabel] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));

  useEffect(() => {
    setIsSupported('BarcodeDetector' in window);
    initDevices();
    return () => stopCamera();
  }, []);

  const initDevices = async () => {
    try {
      setCameraStatus('Requesting permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      addLog("Permission granted");
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      addLog(`Found ${videoDevices.length} cameras`);

      // 임시 스트림 즉시 종료 (자원 해제)
      stream.getTracks().forEach(t => t.stop());

      if (videoDevices.length > 0) {
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back')) || videoDevices[0];
        setSelectedDeviceId(backCamera.deviceId);
      }
    } catch (err) {
      setError(`Init Error: ${err.name} - ${err.message}`);
      addLog("Permission/Init failed");
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const startCamera = async (deviceId) => {
    stopCamera();
    setCameraStatus('Connecting...');
    addLog(`Connecting to ${deviceId.slice(0, 8)}...`);

    try {
      const constraints = {
        video: {
          deviceId: { ideal: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        setCameraLabel(track.label);
        
        videoRef.current.onloadedmetadata = () => {
          setVideoDim({ 
            w: videoRef.current.videoWidth, 
            h: videoRef.current.videoHeight 
          });
          setCameraStatus('Playing');
          addLog("Video stream active");
          startScanning();
        };
      }
    } catch (err) {
      setError(`Camera Error: ${err.message}`);
      setCameraStatus('Failed');
      addLog("Stream connection failed");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setCameraStatus('Stopped');
    }
  };

  const startScanning = async () => {
    if (!('BarcodeDetector' in window)) return;
    
    try {
      // @ts-ignore
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || cameraStatus === 'Stopped') return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            setLastDecodedText(barcodes[0].rawValue);
            if (navigator.vibrate) navigator.vibrate(50);
          }
        } catch (e) {}
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch (e) {
      addLog("Detector init failed");
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', color: '#0f0', minHeight: '100vh', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <button onClick={() => navigate('/')} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px' }}>EXIT</button>
        <button onClick={() => window.location.reload()} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px' }}>RELOAD</button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <select 
          value={selectedDeviceId} 
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}
        >
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${devices.indexOf(d)}`}</option>
          ))}
        </select>
      </div>

      <div style={{ width: '100%', background: '#111', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', marginBottom: '15px', minHeight: '200px' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>

      <div style={{ background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '15px', fontSize: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '5px' }}>
          <span style={{ color: '#888' }}>STATUS:</span> <span style={{ color: cameraStatus === 'Playing' ? '#0f0' : '#f00' }}>{cameraStatus}</span>
          <span style={{ color: '#888' }}>INFO:</span> <span>{videoDim.w}x{videoDim.h} ({cameraLabel})</span>
          <span style={{ color: '#888' }}>DETECTOR:</span> <span>{isSupported ? 'OK' : 'NOT SUPPORTED'}</span>
        </div>
        {error && <div style={{ color: '#f55', marginTop: '10px', wordBreak: 'break-all' }}>ERR: {error}</div>}
      </div>

      <div style={{ background: '#000', padding: '15px', borderRadius: '12px', border: '1px solid #0f0' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#888' }}>DECODED TEXT:</p>
        <p style={{ margin: 0, fontWeight: 'bold', wordBreak: 'break-all', fontSize: '16px', color: '#fff', minHeight: '24px' }}>
          {lastDecodedText || 'Scanning...'}
        </p>
      </div>

      <div style={{ marginTop: '15px', padding: '10px', background: '#050505', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#444' }}>SYSTEM LOGS:</p>
        {logs.map((log, i) => <div key={i} style={{ fontSize: '10px', color: '#666' }}>{log}</div>)}
      </div>
    </div>
  );
};

export default QRMinTest;
