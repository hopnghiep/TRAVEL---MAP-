/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  FolderPlus, 
  Trash2, 
  Image as ImageIcon, 
  ChevronRight, 
  Youtube, 
  Map as MapIcon,
  Plus,
  X,
  Loader2,
  Folder,
  Share2,
  Check,
  Send,
  MessageSquare,
  RefreshCw,
  Video,
  Search,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { Map, Marker, Overlay } from "pigeon-maps";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Tour, type Step } from './components/Tour';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Photo {
  id: number;
  folder_id: number;
  data: string;
  lat: number | null;
  lng: number | null;
  ai_insights: string | null;
  timestamp: string;
}

interface FolderType {
  id: number;
  name: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'camera' | 'gallery' | 'explore'>('camera');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [viewingFolderId, setViewingFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [savedPhotoId, setSavedPhotoId] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [nearbyInsights, setNearbyInsights] = useState<string>('');
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [videoPlatform, setVideoPlatform] = useState<'youtube' | 'tiktok'>('youtube');
  const [exploreMode, setExploreMode] = useState<'nearby' | 'request'>('nearby');
  const [exploreRequestInput, setExploreRequestInput] = useState('');
  const [exploreRequestResult, setExploreRequestResult] = useState('');
  const [isLoadingExploreRequest, setIsLoadingExploreRequest] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchFolders();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (activeTab === 'gallery' || activeTab === 'explore') {
      fetchPhotos();
    }
  }, [activeTab, viewingFolderId]);

  useEffect(() => {
    if (selectedPhoto) {
      setAiSuggestions(selectedPhoto.ai_insights || '');
      setChatMessages([]);
    }
  }, [selectedPhoto]);

  const fetchFolders = async () => {
    const res = await fetch('/api/folders');
    const data = await res.json();
    setFolders(data);
    if (data.length > 0 && !selectedFolderId) {
      setSelectedFolderId(data[0].id);
    }
  };

  const fetchPhotos = async () => {
    // Use viewingFolderId if in gallery, otherwise use selectedFolderId for saving
    // If in explore tab, fetch all photos (folderId = null)
    let folderId = null;
    if (activeTab === 'gallery') {
      folderId = viewingFolderId;
    } else if (activeTab === 'camera') {
      folderId = selectedFolderId;
    }
    
    const folderParam = (folderId !== null && folderId !== undefined) ? `?folderId=${folderId}` : '';
    const url = `/api/photos${folderParam}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setPhotos(data);
    } catch (error) {
      console.error("Fetch photos error:", error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error("Error getting location:", error)
      );
    }
  };

  const startCamera = async () => {
    setIsCapturing(true);
    setCapturedImage(null);
    setIsSaved(false);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Không thể truy cập máy ảnh. Vui lòng kiểm tra quyền truy cập trong cài đặt trình duyệt.");
      setIsCapturing(false);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (isCapturing) {
      startCamera();
    }
  }, [facingMode]);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
  }, []);

  const onboardingSteps: Step[] = [
    {
      icon: '👋',
      title: 'Chào mừng bạn!',
      content: 'Chào mừng bạn đến với TravelSnap - ứng dụng lưu giữ khoảnh khắc du lịch của bạn bằng AI.',
      selector: 'body',
    },
    {
      icon: '📸',
      title: 'Chụp ảnh',
      content: 'Đây là nơi bạn bắt đầu. Nhấn vào biểu tượng máy ảnh để chụp những khoảnh khắc đẹp nhất.',
      selector: '#step-camera-tab',
      side: 'top',
    },
    {
      icon: '📁',
      title: 'Thư viện',
      content: 'Quản lý toàn bộ ảnh của bạn tại đây, sắp xếp theo thư mục thông minh.',
      selector: '#step-gallery-tab',
      side: 'top',
    },
    {
      icon: '🌍',
      title: 'Khám phá',
      content: 'Xem lại vị trí ảnh trên bản đồ và nhận các gợi ý địa điểm xung quanh bằng AI.',
      selector: '#step-explore-tab',
      side: 'top',
    },
    {
      icon: '✨',
      title: 'Sẵn sàng chưa?',
      content: 'Hãy bắt đầu hành trình của bạn ngay bây giờ!',
      selector: '#step-camera-tab',
      side: 'top',
    }
  ];

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      stopCamera();
      // Removed automatic AI call
    }
  };

  const savePhoto = async () => {
    if (!capturedImage || !selectedFolderId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          data: capturedImage,
          lat: location?.lat,
          lng: location?.lng,
          ai_insights: aiSuggestions || null,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSavedPhotoId(data.id);
        setIsSaved(true);
        fetchPhotos(); // Refresh photos list immediately
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePhotoFolder = async (photoId: number, folderId: number) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/photos/${photoId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      
      if (res.ok) {
        if (selectedPhoto) {
          setSelectedPhoto({ ...selectedPhoto, folder_id: folderId });
        }
        setIsChangingFolder(false);
        fetchPhotos();
      }
    } catch (error) {
      console.error("Update error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePhoto = async (id: number) => {
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    fetchPhotos();
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (res.ok) {
        const folder = await res.json();
        setFolders([...folders, folder]);
        setSelectedFolderId(folder.id);
        setNewFolderName('');
        setTimeout(() => {
          setShowNewFolderModal(false);
          setIsCreatingFolder(false);
        }, 600);
      } else {
        setIsCreatingFolder(false);
      }
    } catch (error) {
      console.error("Create folder error:", error);
      setIsCreatingFolder(false);
    }
  };

  const deleteFolder = async (id: number) => {
    if (confirm("Delete this folder and all its photos?")) {
      await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      fetchFolders();
      setSelectedFolderId(folders[0]?.id || null);
    }
  };

  const getAiInsights = async (imageData: string) => {
    setIsLoadingAi(true);
    setAiSuggestions('');
    setChatMessages([]); // Reset chat when getting new insights
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Tôi đang ở tọa độ: ${location?.lat}, ${location?.lng}.
        
        Nhiệm vụ của bạn:
        1. **Xác định địa điểm**: Dựa vào tọa độ GPS trên, hãy xác định chính xác tên địa danh, công trình hoặc khu vực du lịch này.
        2. **Phân tích hình ảnh**: Dựa trên địa điểm đã xác định, hãy mô tả nội dung hình ảnh này (ví dụ: đây là góc nhìn nào của địa danh đó, có đặc điểm gì nổi bật).
        3. **YÊU CẦU QUAN TRỌNG**: 
           - Nếu không thể xác định địa điểm từ tọa độ hoặc hình ảnh, hãy ghi rõ "Chưa có thông tin về địa điểm này", TUYỆT ĐỐI không được suy đoán hoặc tự tạo ra thông tin không có căn cứ.
           - Nếu hình ảnh không liên quan đến địa điểm du lịch (ví dụ: chụp đồ vật cá nhân, màn hình...), hãy ghi "Hình ảnh không chứa thông tin du lịch tại vị trí này".
        
        **YÊU CẦU KIỂM CHỨNG LINK ${videoPlatform === 'youtube' ? 'YOUTUBE' : 'TIKTOK'}**:
        1. Tìm và cung cấp các link ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} thực tế giới thiệu về địa điểm đã xác định.
        2. Luôn kèm theo **Link tìm kiếm ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} dự phòng**.
        
        Trình bày chuyên nghiệp bằng Markdown bằng tiếng Việt.
      `;

      const base64Data = imageData.split(',')[1];
      const result = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
          ]
        },
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setAiSuggestions(result.text || "No insights found.");
    } catch (err) {
      console.error("AI Error:", err);
      setAiSuggestions("Failed to get AI insights.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const getNearbyInsights = async () => {
    if (!location) return;
    setIsLoadingNearby(true);
    setNearbyInsights('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Tôi đang ở tọa độ: ${location.lat}, ${location.lng}.
        Hãy sử dụng công cụ tìm kiếm để giới thiệu các địa điểm du lịch nổi bật, di tích lịch sử hoặc điểm check-in lân cận vị trí này.
        
        Yêu cầu:
        1. Giới thiệu ít nhất 3 địa điểm nổi bật nhất.
        2. Với mỗi địa điểm, hãy cung cấp:
           - Tên địa điểm.
           - Mô tả ngắn gọn về nét đặc sắc.
           - Link video ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} giới thiệu thực tế (phải kiểm chứng link hoạt động).
           - Link tìm kiếm ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} dự phòng.
        3. **YÊU CẦU QUAN TRỌNG**: Nếu không tìm thấy địa điểm nổi bật nào lân cận tọa độ này, hãy ghi rõ "Chưa có thông tin du lịch nổi bật tại vị trí này", tuyệt đối không tự tạo thông tin.
        4. Trình bày chuyên nghiệp bằng Markdown bằng tiếng Việt.
      `;

      const result = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: { tools: [{ googleSearch: {} }] }
      });

      setNearbyInsights(result.text || "Không tìm thấy thông tin lân cận.");
    } catch (err) {
      console.error("Nearby Insights error:", err);
      setNearbyInsights("Đã xảy ra lỗi khi tìm kiếm thông tin lân cận.");
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const getExploreByRequest = async () => {
    if (!location || !exploreRequestInput.trim()) return;
    setIsLoadingExploreRequest(true);
    setExploreRequestResult('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Tôi đang ở tọa độ: ${location.lat}, ${location.lng}.
        Yêu cầu của tôi: "${exploreRequestInput}"
        
        Nhiệm vụ của bạn:
        1. Tìm kiếm các địa điểm hoặc thông tin phù hợp nhất với yêu cầu trên tại khu vực lân cận tôi.
        2. Với mỗi địa điểm tìm được, hãy cung cấp:
           - Tên địa điểm.
           - Tại sao nó phù hợp với yêu cầu của tôi.
           - Link video ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} thực tế.
           - Link tìm kiếm dự phòng.
        3. Nếu yêu cầu không rõ ràng hoặc không tìm thấy kết quả phù hợp, hãy thông báo lịch sự và gợi ý các lựa chọn khác.
        
        Trình bày chuyên nghiệp bằng Markdown bằng tiếng Việt.
      `;

      const result = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: { tools: [{ googleSearch: {} }] }
      });

      setExploreRequestResult(result.text || "Không tìm thấy kết quả phù hợp.");
    } catch (err) {
      console.error("Explore request error:", err);
      setExploreRequestResult("Đã xảy ra lỗi khi thực hiện yêu cầu khám phá.");
    } finally {
      setIsLoadingExploreRequest(false);
    }
  };

  const generateInsightsForPhoto = async (photo: Photo) => {
    setIsLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Hình ảnh này được chụp tại tọa độ: ${photo.lat}, ${photo.lng}.
        
        Nhiệm vụ của bạn:
        1. **Xác định địa điểm**: Dựa vào tọa độ GPS trên, hãy xác định chính xác tên địa danh hoặc khu vực du lịch này.
        2. **Phân tích hình ảnh**: Dựa trên địa điểm đã xác định, hãy mô tả nội dung hình ảnh này.
        3. **YÊU CẦU QUAN TRỌNG**: 
           - Nếu không thể xác định địa điểm từ tọa độ hoặc hình ảnh, hãy ghi rõ "Chưa có thông tin về địa điểm này", TUYỆT ĐỐI không được suy đoán.
           - Nếu hình ảnh không liên quan đến địa điểm du lịch, hãy ghi "Hình ảnh không chứa thông tin du lịch tại vị trí này".
        
        Cung cấp các link ${videoPlatform === 'youtube' ? 'YouTube' : 'TikTok'} giới thiệu về địa điểm này kèm link tìm kiếm dự phòng.
        Trình bày bằng Markdown tiếng Việt.
      `;

      const base64Data = photo.data.split(',')[1];
      const result = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
          ]
        },
        config: { tools: [{ googleSearch: {} }] }
      });

      const insights = result.text || "Không có thông tin.";
      
      // Update DB
      await fetch(`/api/photos/${photo.id}/insights`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_insights: insights })
      });

      setAiSuggestions(insights);
      // Update local state
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, ai_insights: insights } : p));
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto({ ...selectedPhoto, ai_insights: insights });
      }
    } catch (err) {
      console.error("Generate insights error:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";
      
      const history = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      // Include initial context if it's the first message
      const initialContext = `
        Đây là bối cảnh từ hình ảnh tôi đã chụp:
        ${aiSuggestions}
        
        Hãy trả lời câu hỏi của tôi dựa trên bối cảnh này và kiến thức của bạn.
      `;

      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction: "Bạn là một hướng dẫn viên du lịch thông minh. Hãy trả lời thân thiện, hữu ích và chính xác bằng tiếng Việt.",
        },
        history: history.length === 0 ? [] : history
      });

      const messageWithContext = history.length === 0 ? `${initialContext}\n\nCâu hỏi: ${userMessage}` : userMessage;
      const result = await chat.sendMessage({ message: messageWithContext });
      
      setChatMessages(prev => [...prev, { role: 'model', text: result.text || 'Xin lỗi, tôi không thể trả lời lúc này.' }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: 'Đã xảy ra lỗi khi kết nối với AI.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const openInGoogleMaps = () => {
    if (location) {
      window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
    }
  };

  const handleShare = async (photo: Photo) => {
    try {
      if (navigator.share) {
        const response = await fetch(photo.data);
        const blob = await response.blob();
        const file = new File([blob], `travel-snap-${photo.id}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'TravelSnap Moment',
            text: 'Xem khoảnh khắc du lịch của tôi!',
          });
        } else {
          await navigator.share({
            title: 'TravelSnap Moment',
            text: 'Xem khoảnh khắc du lịch của tôi!',
            url: window.location.href
          });
        }
      } else {
        alert("Trình duyệt của bạn không hỗ trợ tính năng chia sẻ trực tiếp.");
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-20">
      <Tour 
        steps={onboardingSteps} 
        open={showOnboarding} 
        onComplete={() => setShowOnboarding(false)} 
      />
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Camera size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {activeTab === 'camera' ? 'TravelSnap' : activeTab === 'gallery' ? 'Thư viện' : 'Khám phá'}
          </h1>
        </div>
        <button 
          onClick={openInGoogleMaps}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-medium transition-colors"
        >
          <MapPin size={16} className="text-emerald-600" />
          <span>Maps</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {activeTab === 'camera' && (
          <div className="space-y-6">
            {!isCapturing && !capturedImage && (
              <div className="aspect-[3/4] bg-stone-200 rounded-3xl flex flex-col items-center justify-center gap-4 border-2 border-dashed border-stone-300">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Camera size={32} className="text-stone-400" />
                </div>
                <p className="text-stone-500 font-medium">Ready to capture your moment?</p>
                <button 
                  onClick={startCamera}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                >
                  Start Camera
                </button>
              </div>
            )}

            {isCapturing && (
              <div className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
                  <button 
                    onClick={stopCamera}
                    className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 hover:bg-white/40 transition-all"
                    title="Đóng"
                  >
                    <X size={24} />
                  </button>
                  <button 
                    onClick={capturePhoto}
                    className="w-20 h-20 bg-white rounded-full border-8 border-white/30 shadow-inner flex items-center justify-center active:scale-90 transition-transform"
                    title="Chụp ảnh"
                  >
                    <div className="w-14 h-14 bg-white rounded-full border-2 border-stone-200" />
                  </button>
                  <button 
                    onClick={switchCamera}
                    className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 hover:bg-white/40 transition-all"
                    title="Đổi camera"
                  >
                    <RefreshCw size={24} />
                  </button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl">
                  <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => setCapturedImage(null)}
                      className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Video size={20} className="text-emerald-600" />
                      Nền tảng video
                    </h3>
                    <div className="flex bg-stone-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setVideoPlatform('youtube')}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                          videoPlatform === 'youtube' ? "bg-white text-red-600 shadow-sm" : "text-stone-400"
                        )}
                      >
                        YouTube
                      </button>
                      <button 
                        onClick={() => setVideoPlatform('tiktok')}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                          videoPlatform === 'tiktok' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
                        )}
                      >
                        TikTok
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Folder size={20} className="text-emerald-600" />
                    {isSaved ? "Đã lưu vào thư mục" : "Lưu vào thư mục"}
                  </h3>
                  {!isSaved || isChangingFolder ? (
                    <>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {folders.map(f => (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            key={f.id}
                            onClick={() => setSelectedFolderId(f.id)}
                            className={cn(
                              "px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2",
                              selectedFolderId === f.id 
                                ? "bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm" 
                                : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                              selectedFolderId === f.id ? "bg-emerald-600 border-emerald-600" : "border-stone-300"
                            )}>
                              {selectedFolderId === f.id && <Check size={10} className="text-white" />}
                            </div>
                            {f.name}
                          </motion.button>
                        ))}
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowNewFolderModal(true)}
                          className="px-4 py-2.5 bg-stone-50 text-stone-500 rounded-2xl border-2 border-dashed border-stone-200 hover:border-stone-300 hover:text-stone-600 transition-all flex items-center gap-2 font-bold text-sm"
                        >
                          <Plus size={18} />
                          Mới
                        </motion.button>
                      </div>
                      <button 
                        disabled={isSaving}
                        onClick={() => {
                          if (isChangingFolder && savedPhotoId) {
                            updatePhotoFolder(savedPhotoId, selectedFolderId!);
                          } else {
                            savePhoto();
                          }
                        }}
                        className={cn(
                          "w-full py-4 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2",
                          isSaving ? "bg-stone-400 cursor-not-allowed" : "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700"
                        )}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          <span>{isChangingFolder ? "Cập nhật thư mục" : "Lưu hình ảnh"}</span>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold">
                        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Plus size={14} />
                        </div>
                        Đã lưu vào: {folders.find(f => f.id === selectedFolderId)?.name}
                      </div>
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => setIsChangingFolder(true)}
                          className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-all"
                        >
                          Thay đổi
                        </button>
                        <button 
                          onClick={() => setActiveTab('gallery')}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                        >
                          Thư viện
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Youtube size={20} className="text-red-600" />
                      AI Insights & Guides
                    </h3>
                    {aiSuggestions && !isLoadingAi && (
                      <button 
                        onClick={() => capturedImage && getAiInsights(capturedImage)}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Cập nhật lại thông tin"
                      >
                        <Loader2 size={16} className={cn(isLoadingAi && "animate-spin")} />
                      </button>
                    )}
                  </div>
                  {isLoadingAi ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="animate-spin text-emerald-600" size={32} />
                      <p className="text-stone-500 text-sm">Gemini đang kiểm chứng và phân tích ảnh...</p>
                    </div>
                  ) : aiSuggestions ? (
                    <div className="space-y-8">
                      <div className="prose prose-stone max-w-none">
                        <Markdown 
                          components={{
                            a: ({ node, ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-600 font-bold hover:underline break-all"
                              />
                            )
                          }}
                        >
                          {aiSuggestions}
                        </Markdown>
                      </div>

                      {/* Chat Interface */}
                      <div className="border-t border-stone-100 pt-8">
                        <h4 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
                          <MessageSquare size={18} className="text-emerald-600" />
                          Hỏi thêm về địa điểm này
                        </h4>
                        
                        <div className="space-y-4 mb-6">
                          {chatMessages.map((msg, i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "flex flex-col max-w-[85%]",
                                msg.role === 'user' ? "ml-auto items-end" : "items-start"
                              )}
                            >
                              <div className={cn(
                                "px-4 py-3 rounded-2xl text-sm",
                                msg.role === 'user' 
                                  ? "bg-emerald-600 text-white rounded-tr-none" 
                                  : "bg-stone-100 text-stone-800 rounded-tl-none"
                              )}>
                                <Markdown>{msg.text}</Markdown>
                              </div>
                            </div>
                          ))}
                          {isChatting && (
                            <div className="flex items-center gap-2 text-stone-400 text-xs animate-pulse">
                              <Loader2 size={12} className="animate-spin" />
                              AI đang trả lời...
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Bạn muốn biết thêm điều gì?"
                            className="w-full pl-5 pr-12 py-4 bg-stone-50 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-medium text-sm"
                          />
                          <button 
                            disabled={isChatting || !chatInput.trim()}
                            onClick={sendChatMessage}
                            className={cn(
                              "absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                              chatInput.trim() ? "bg-emerald-600 text-white shadow-md" : "bg-stone-200 text-stone-400"
                            )}
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-4">
                      <p className="text-stone-500 text-sm text-center">Nhấn để nhận thông tin du lịch và link YouTube từ AI</p>
                      <button 
                        onClick={() => capturedImage && getAiInsights(capturedImage)}
                        className="px-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-full text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                      >
                        <Youtube size={16} />
                        Xem gợi ý AI
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setCapturedImage(null)}
                  className="w-full py-4 bg-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-300 transition-all"
                >
                  Quay lại Máy ảnh
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-6">
            <div className="h-[300px] w-full rounded-[32px] overflow-hidden border border-stone-200 shadow-inner bg-stone-100 relative">
              <Map 
                height={undefined} 
                center={location ? [location.lat, location.lng] : [10.762622, 106.660172]} 
                defaultZoom={13}
              >
                {photos.filter(p => p.lat && p.lng).map(photo => (
                  <Overlay 
                    key={photo.id} 
                    anchor={[photo.lat!, photo.lng!]}
                    offset={[24, 40]}
                  >
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1, zIndex: 50 }}
                      onClick={() => setSelectedPhoto(photo)}
                      className="relative flex flex-col items-center cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl border-2 border-white shadow-lg overflow-hidden bg-stone-200">
                        <img src={photo.data} className="w-full h-full object-cover" alt="Thumb" />
                        <div className="absolute inset-0 bg-emerald-600/10 group-hover:bg-transparent transition-colors" />
                      </div>
                      <div className="mt-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-stone-100">
                         <p className="text-[8px] font-bold text-stone-600 whitespace-nowrap">
                           {new Date(photo.timestamp).toLocaleDateString('vi-VN')}
                         </p>
                      </div>
                    </motion.div>
                  </Overlay>
                ))}
                
                {location && (
                  <Marker 
                    anchor={[location.lat, location.lng]} 
                    color="#10b981"
                  />
                )}
              </Map>
              
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200 shadow-sm pointer-events-auto">
                  <p className="text-xs font-bold text-stone-900 flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-600" />
                    {photos.filter(p => p.lat && p.lng).length} địa điểm đã lưu
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-stone-100">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex bg-stone-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setExploreMode('nearby')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                        exploreMode === 'nearby' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-400"
                      )}
                    >
                      <Compass size={14} />
                      Xung quanh
                    </button>
                    <button 
                      onClick={() => setExploreMode('request')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                        exploreMode === 'request' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-400"
                      )}
                    >
                      <Search size={14} />
                      Theo yêu cầu
                    </button>
                  </div>

                  <div className="flex bg-stone-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setVideoPlatform('youtube')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                        videoPlatform === 'youtube' ? "bg-white text-red-600 shadow-sm" : "text-stone-400"
                      )}
                    >
                      YouTube
                    </button>
                    <button 
                      onClick={() => setVideoPlatform('tiktok')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                        videoPlatform === 'tiktok' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
                      )}
                    >
                      TikTok
                    </button>
                  </div>
                </div>

                {exploreMode === 'nearby' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Share2 size={20} className="text-emerald-600" />
                        Khám phá xung quanh
                      </h3>
                      {nearbyInsights && !isLoadingNearby && (
                        <button 
                          onClick={getNearbyInsights}
                          className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        >
                          <Loader2 size={16} />
                        </button>
                      )}
                    </div>

                    {isLoadingNearby ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="animate-spin text-emerald-600" size={32} />
                        <p className="text-stone-500 text-sm">Gemini đang tìm kiếm các địa điểm thú vị...</p>
                      </div>
                    ) : nearbyInsights ? (
                      <div className="prose prose-stone max-w-none">
                        <Markdown 
                          components={{
                            a: ({ node, ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-600 font-bold hover:underline break-all"
                              />
                            )
                          }}
                        >
                          {nearbyInsights}
                        </Markdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 gap-6">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                          <MapIcon size={32} />
                        </div>
                        <div className="text-center">
                          <p className="text-stone-900 font-bold mb-1">Bạn đang ở đâu?</p>
                          <p className="text-stone-500 text-sm">Nhấn để AI phân tích vị trí hiện tại và gợi ý các điểm du lịch nổi bật lân cận.</p>
                        </div>
                        <button 
                          onClick={getNearbyInsights}
                          className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
                        >
                          <Share2 size={18} />
                          Khám phá ngay
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={exploreRequestInput}
                        onChange={(e) => setExploreRequestInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && getExploreByRequest()}
                        placeholder="Bạn muốn tìm gì? (VD: Quán cafe view đẹp, Chỗ ăn đêm...)"
                        className="w-full pl-5 pr-12 py-4 bg-stone-50 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-medium text-sm"
                      />
                      <button 
                        disabled={isLoadingExploreRequest || !exploreRequestInput.trim()}
                        onClick={getExploreByRequest}
                        className={cn(
                          "absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          exploreRequestInput.trim() ? "bg-emerald-600 text-white shadow-md" : "bg-stone-200 text-stone-400"
                        )}
                      >
                        {isLoadingExploreRequest ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>

                    {isLoadingExploreRequest ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="animate-spin text-emerald-600" size={32} />
                        <p className="text-stone-500 text-sm">Gemini đang tìm kiếm theo yêu cầu của bạn...</p>
                      </div>
                    ) : exploreRequestResult ? (
                      <div className="prose prose-stone max-w-none bg-stone-50 rounded-2xl p-6 border border-stone-100">
                        <Markdown 
                          components={{
                            a: ({ node, ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-600 font-bold hover:underline break-all"
                              />
                            )
                          }}
                        >
                          {exploreRequestResult}
                        </Markdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                        <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-300">
                          <Search size={32} />
                        </div>
                        <div>
                          <p className="text-stone-900 font-bold mb-1">Tìm kiếm theo ý muốn</p>
                          <p className="text-stone-500 text-sm">Nhập yêu cầu cụ thể để AI tìm kiếm các địa điểm phù hợp nhất quanh bạn.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {viewingFolderId ? (
                  <button 
                    onClick={() => setViewingFolderId(null)}
                    className="p-2 bg-white border border-stone-200 rounded-full text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <ChevronRight size={20} className="rotate-180" />
                  </button>
                ) : (
                  <button 
                    onClick={() => setActiveTab('camera')}
                    className="p-2 bg-white border border-stone-200 rounded-full text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <Camera size={20} />
                  </button>
                )}
                <h2 className="text-xl font-bold text-stone-900">
                  {viewingFolderId 
                    ? folders.find(f => f.id === viewingFolderId)?.name 
                    : "Thư viện của tôi"}
                </h2>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowNewFolderModal(true)}
                  className="p-2 bg-white border border-stone-200 rounded-full text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  <Plus size={20} />
                </button>
                {viewingFolderId && folders.find(f => f.id === viewingFolderId)?.name !== 'General' && (
                  <button 
                    onClick={() => {
                      deleteFolder(viewingFolderId);
                      setViewingFolderId(null);
                    }}
                    className="p-2 bg-white border border-stone-200 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>

            {!viewingFolderId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {folders.map(folder => (
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    key={folder.id}
                    onClick={() => setViewingFolderId(folder.id)}
                    className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <Folder size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-stone-900">{folder.name}</h3>
                          <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">Thư mục du lịch</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-stone-300 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {photos.map(photo => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={photo.id} 
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-sm cursor-pointer"
                  >
                    <img src={photo.data} className="w-full h-full object-cover" alt="Saved" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(photo);
                        }}
                        className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-blue-500 transition-colors"
                        title="Chia sẻ"
                      >
                        <Share2 size={20} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhoto(photo.id);
                        }}
                        className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={20} />
                      </button>
                      {photo.lat && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/maps?q=${photo.lat},${photo.lng}`, '_blank');
                          }}
                          className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-emerald-500 transition-colors"
                        >
                          <MapPin size={20} />
                        </button>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] text-white/80 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-md inline-block">
                        {new Date(photo.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
                {photos.length === 0 && (
                  <div className="col-span-2 py-20 text-center">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-stone-400 font-medium">Thư mục này chưa có hình ảnh nào.</p>
                    <button 
                      onClick={() => setActiveTab('camera')}
                      className="mt-4 text-emerald-600 font-bold hover:underline"
                    >
                      Chụp ảnh ngay
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-stone-200 px-8 py-4 flex justify-around items-center z-40">
        <button 
          id="step-camera-tab"
          onClick={() => setActiveTab('camera')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'camera' ? "text-emerald-600 scale-110" : "text-stone-400"
          )}
        >
          <Camera size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Máy ảnh</span>
        </button>
        <button 
          id="step-explore-tab"
          onClick={() => setActiveTab('explore')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'explore' ? "text-emerald-600 scale-110" : "text-stone-400"
          )}
        >
          <MapIcon size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Khám phá</span>
        </button>
        <button 
          id="step-gallery-tab"
          onClick={() => {
            setActiveTab('gallery');
            setViewingFolderId(null);
          }}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'gallery' ? "text-emerald-600 scale-110" : "text-stone-400"
          )}
        >
          <ImageIcon size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Thư viện</span>
        </button>
      </nav>

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFolderModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl border border-stone-100"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <FolderPlus size={20} />
                </div>
                <h2 className="text-xl font-bold">Tạo thư mục mới</h2>
              </div>
              
              <div className="relative mb-8">
                <input 
                  autoFocus
                  type="text" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Tên thư mục (vd: Đà Lạt 2024)"
                  className="w-full px-5 py-4 bg-stone-50 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-medium"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  disabled={isCreatingFolder}
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 py-4 text-stone-400 font-bold hover:text-stone-600 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  onClick={createFolder}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2",
                    isCreatingFolder 
                      ? "bg-emerald-100 text-emerald-400 cursor-not-allowed" 
                      : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                  )}
                >
                  {isCreatingFolder ? (
                    <>
                      <Check size={20} className="animate-bounce" />
                      <span>Đã tạo!</span>
                    </>
                  ) : (
                    <span>Tạo ngay</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPhoto(null)}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto no-scrollbar">
                <div className="aspect-[4/3] sm:aspect-video w-full bg-stone-100">
                  <img src={selectedPhoto.data} className="w-full h-full object-cover" alt="Detail" />
                </div>
                
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
                        {new Date(selectedPhoto.timestamp).toLocaleDateString('vi-VN', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <h2 className="text-2xl font-bold text-stone-900">Chi tiết hình ảnh</h2>
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-2">
                          <Folder size={14} className="text-stone-400" />
                          <span className="text-sm text-stone-500 font-medium">Thư mục: {folders.find(f => f.id === selectedPhoto.folder_id)?.name}</span>
                        </div>
                        {selectedPhoto.lat && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-stone-400" />
                            <span className="text-xs text-stone-400 font-mono">
                              Tọa độ: {selectedPhoto.lat.toFixed(6)}, {selectedPhoto.lng?.toFixed(6)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedPhoto.lat && (
                        <button 
                          onClick={() => window.open(`https://www.google.com/maps?q=${selectedPhoto.lat},${selectedPhoto.lng}`, '_blank')}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <MapPin size={16} />
                          <span>Bản đồ</span>
                        </button>
                      )}
                      <button 
                        onClick={() => setIsChangingFolder(!isChangingFolder)}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-full text-sm font-bold hover:bg-stone-200 transition-colors"
                      >
                        <FolderPlus size={16} />
                        <span>Đổi thư mục</span>
                      </button>
                    </div>
                  </div>

                  {isChangingFolder && (
                    <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 animate-in fade-in slide-in-from-top-2">
                      <p className="text-xs font-bold text-stone-400 uppercase mb-3">Chọn thư mục mới</p>
                      <div className="flex flex-wrap gap-2">
                        {folders.map(f => (
                          <button
                            key={f.id}
                            onClick={() => updatePhotoFolder(selectedPhoto.id, f.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                              selectedPhoto.folder_id === f.id 
                                ? "bg-emerald-600 text-white" 
                                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                            )}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPhoto.ai_insights ? (
                    <div className="space-y-6">
                      <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                          <Youtube size={16} />
                          Thông tin từ AI
                        </h3>
                        <div className="prose prose-stone prose-sm max-w-none">
                          <Markdown 
                            components={{
                              a: ({ node, ...props }) => (
                                <a 
                                  {...props} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-emerald-600 font-bold hover:underline break-all"
                                />
                              )
                            }}
                          >
                            {selectedPhoto.ai_insights}
                          </Markdown>
                        </div>
                      </div>

                      {/* Chat Interface in Detail View */}
                      <div className="border-t border-stone-100 pt-6">
                        <h4 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
                          <MessageSquare size={18} className="text-emerald-600" />
                          Hỏi thêm về địa điểm này
                        </h4>
                        
                        <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto no-scrollbar p-1">
                          {chatMessages.map((msg, i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "flex flex-col max-w-[85%]",
                                msg.role === 'user' ? "ml-auto items-end" : "items-start"
                              )}
                            >
                              <div className={cn(
                                "px-4 py-3 rounded-2xl text-sm",
                                msg.role === 'user' 
                                  ? "bg-emerald-600 text-white rounded-tr-none" 
                                  : "bg-stone-100 text-stone-800 rounded-tl-none"
                              )}>
                                <Markdown>{msg.text}</Markdown>
                              </div>
                            </div>
                          ))}
                          {isChatting && (
                            <div className="flex items-center gap-2 text-stone-400 text-xs animate-pulse">
                              <Loader2 size={12} className="animate-spin" />
                              AI đang trả lời...
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Bạn muốn biết thêm điều gì?"
                            className="w-full pl-5 pr-12 py-4 bg-stone-50 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-medium text-sm"
                          />
                          <button 
                            disabled={isChatting || !chatInput.trim()}
                            onClick={sendChatMessage}
                            className={cn(
                              "absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                              chatInput.trim() ? "bg-emerald-600 text-white shadow-md" : "bg-stone-200 text-stone-400"
                            )}
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                      <div className="bg-stone-50 rounded-2xl p-8 border border-stone-100 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Video size={32} className="text-stone-300" />
                        </div>
                        <div className="flex bg-stone-100 p-1 rounded-xl mb-2">
                          <button 
                            onClick={() => setVideoPlatform('youtube')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                              videoPlatform === 'youtube' ? "bg-white text-red-600 shadow-sm" : "text-stone-400"
                            )}
                          >
                            YouTube
                          </button>
                          <button 
                            onClick={() => setVideoPlatform('tiktok')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                              videoPlatform === 'tiktok' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
                            )}
                          >
                            TikTok
                          </button>
                        </div>
                        <p className="text-stone-500 text-sm font-medium">Hình ảnh này chưa có thông tin phân tích từ AI.</p>
                        <button 
                          disabled={isLoadingAi}
                          onClick={() => generateInsightsForPhoto(selectedPhoto)}
                          className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                        >
                          {isLoadingAi ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                          AI Insights & Guides
                        </button>
                      </div>
                  )}

                  <div className="pt-4 flex gap-4">
                    <button 
                      onClick={() => handleShare(selectedPhoto)}
                      className="flex-1 py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 size={20} />
                      Chia sẻ
                    </button>
                    <button 
                      onClick={() => {
                        deletePhoto(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }}
                      className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={20} />
                      Xóa hình ảnh
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
