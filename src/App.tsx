/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage, signIn, signOut } from './firebase';
import { cn } from './lib/utils';
import { 
  Search, 
  ShoppingBag, 
  Filter, 
  Plus, 
  LogOut, 
  User as UserIcon,
  Loader2,
  Disc,
  X,
  Pencil,
  Info,
  ChevronDown,
  ArrowUp,
  Cookie,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';

// Types
interface Album {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  price: number;
  coverUrl: string;
  stock: number;
  description: string;
  purchaseUrl?: string;
  tracklist?: string;
  discount?: number;
  tracksCount?: number;
  audioUrl?: string;
  createdAt: any;
}

const CustomAudioPlayer = ({ url }: { url: string }) => {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime = (Number(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTime;
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      <button 
        onClick={togglePlay}
        className="w-12 h-12 shrink-0 bg-orange-500 hover:bg-orange-600 text-black rounded-full flex items-center justify-center transition-colors"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-white/40 font-mono">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-2 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
          <div 
            className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress || 0} 
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      <button 
        onClick={toggleMute}
        className="w-8 h-8 shrink-0 text-white/40 hover:text-white transition-colors flex items-center justify-center"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
};

const CustomSelect = ({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: string[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors text-white flex items-center justify-between"
      >
        <span>{value}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#111] border border-white/10 rounded-xl max-h-60 overflow-y-auto shadow-2xl"
          >
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-white/5 transition-colors text-white",
                  value === option && "bg-orange-500/20 text-orange-500"
                )}
              >
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AlbumCard = React.memo(({ album, index, isAdmin, onEdit, onSelect }: { album: Album, index: number, isAdmin: boolean, onEdit: (album: Album) => void, onSelect: (album: Album) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: (index % 20) * 0.05 }}
    className="group cursor-pointer"
    onClick={() => onSelect(album)}
  >
    <div className="relative aspect-square mb-6 overflow-hidden rounded-2xl bg-white/5">
      <img 
        src={album.coverUrl} 
        alt={album.title}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
        {album.purchaseUrl ? (
          <a 
            href={album.purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500"
          >
            <ShoppingBag className="text-black w-6 h-6" />
          </a>
        ) : (
          <button 
            onClick={(e) => e.stopPropagation()}
            className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500"
          >
            <ShoppingBag className="text-black w-6 h-6" />
          </button>
        )}
        {isAdmin && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(album); }}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75"
          >
            <Pencil className="text-black w-6 h-6" />
          </button>
        )}
      </div>
      {album.discount && album.discount > 0 && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 pointer-events-none">
          <div className="h-5 sm:h-6 px-2 sm:px-2.5 bg-orange-500 text-black rounded-full shadow-lg flex items-center justify-center">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-none">-{album.discount}%</span>
          </div>
        </div>
      )}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 pointer-events-none">
        {album.discount && album.discount > 0 ? (
          <div className="py-1 px-2 sm:h-6 sm:py-0 sm:px-2.5 bg-black/50 backdrop-blur-md rounded-lg sm:rounded-full border border-white/10 flex flex-col sm:flex-row items-end sm:items-center justify-center gap-0.5 sm:gap-1.5">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest line-through text-white/40 leading-none">{album.price} ₽</span>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-orange-500 leading-none">
              {Math.round(album.price * (1 - album.discount / 100))} ₽
            </span>
          </div>
        ) : (
          <div className="h-5 sm:h-6 px-2 sm:px-2.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest leading-none">{album.price} ₽</span>
          </div>
        )}
      </div>
    </div>
    
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">{album.genre}</span>
        <span className="text-[10px] font-bold text-white/30">{album.year}</span>
      </div>
      <h3 className="text-lg font-bold truncate group-hover:text-orange-500 transition-colors">{album.title}</h3>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-white/40 font-medium truncate">{album.artist}</p>
        {album.tracksCount ? (
          <span className="text-[10px] font-bold text-white/30 whitespace-nowrap shrink-0">({album.tracksCount} треков)</span>
        ) : null}
      </div>
      <div className="pt-2">
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect(album); }}
          className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Описание альбома</span>
        </button>
      </div>
    </div>
  </motion.div>
));

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
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

const CustomStarIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 100" 
    className={className}
    fill="none"
  >
    <defs>
      <pattern id="hatching" width="8" height="8" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke="white" strokeWidth="1.5" opacity="0.9" />
      </pattern>
    </defs>
    
    <path 
      d="M50 10 L61 38 L90 40 L65 58 L73 86 L50 70 L27 86 L35 58 L10 40 L39 38 Z" 
      fill="#FACC15" 
      stroke="#222" 
      strokeWidth="6" 
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    
    <path 
      d="M50 10 L61 38 L90 40 L65 58 L73 86 L50 70 L27 86 L35 58 L10 40 L39 38 Z" 
      fill="url(#hatching)" 
    />
    
    <path d="M32 45 L42 35 M28 55 L48 38" stroke="#222" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export default function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'discount'>('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const sortRef = React.useRef<HTMLDivElement>(null);
  const [genres, setGenres] = useState<string[]>(["All", "Rock", "Jazz", "Electronic", "Hip Hop", "Classical", "Pop", "Blues"]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddGenreModal, setShowAddGenreModal] = useState(false);
  const [showGenresCloud, setShowGenresCloud] = useState(false);
  const [showNewArrivalsModal, setShowNewArrivalsModal] = useState(false);
  const [newArrivals, setNewArrivals] = useState<Album[]>([]);
  const [loadingNewArrivals, setLoadingNewArrivals] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [originalCoverUrl, setOriginalCoverUrl] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  
  // Form State
  const [newAlbum, setNewAlbum] = useState({
    title: "",
    artist: "",
    genre: "Rock",
    year: new Date().getFullYear(),
    price: 19.99,
    discount: 0,
    coverUrl: "",
    description: "",
    purchaseUrl: "",
    tracklist: "",
    tracksCount: 0,
    audioUrl: ""
  });

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const adminStatus = u?.email?.toLowerCase() === "roktur@gmail.com";
      setIsAdmin(adminStatus);
      if (u) {
        console.log("Logged in as:", u.email, "Admin status:", adminStatus);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch genres
  useEffect(() => {
    const q = query(collection(db, 'genres'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const defaultGenres = ["Rock", "Jazz", "Electronic", "Hip Hop", "Classical", "Pop", "Blues"];
      const fetchedGenres = snapshot.docs.map(doc => doc.data().name);
      const combinedGenres = Array.from(new Set([...defaultGenres, ...fetchedGenres]));
      setGenres(["All", ...combinedGenres]);
    }, (error) => {
      console.error("Error fetching genres:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch new arrivals
  useEffect(() => {
    if (showNewArrivalsModal) {
      const fetchNewArrivals = async () => {
        setLoadingNewArrivals(true);
        try {
          const q = query(collection(db, 'albums'), orderBy('createdAt', 'desc'), limit(3));
          const snapshot = await getDocs(q);
          const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Album));
          setNewArrivals(fetched);
        } catch (error) {
          console.error("Error fetching new arrivals:", error);
        } finally {
          setLoadingNewArrivals(false);
        }
      };
      fetchNewArrivals();
    }
  }, [showNewArrivalsModal]);

  // Initial fetch
  const fetchInitialAlbums = useCallback(async () => {
    setLoading(true);
    try {
      let q;
      if (sortBy === 'discount') {
        if (selectedGenre !== "All") {
          q = query(
            collection(db, 'albums'),
            where('genre', '==', selectedGenre),
            where('discount', '>', 0),
            orderBy('discount', 'desc'),
            limit(20)
          );
        } else {
          q = query(
            collection(db, 'albums'),
            where('discount', '>', 0),
            orderBy('discount', 'desc'),
            limit(20)
          );
        }
      } else {
        const orderField = 'createdAt';
        const orderDirection = sortBy === 'oldest' ? 'asc' : 'desc';
        if (selectedGenre !== "All") {
          q = query(
            collection(db, 'albums'),
            where('genre', '==', selectedGenre),
            orderBy(orderField, orderDirection),
            limit(20)
          );
        } else {
          q = query(
            collection(db, 'albums'),
            orderBy(orderField, orderDirection),
            limit(20)
          );
        }
      }

      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'albums'));
      if (!snapshot) return;
      const fetchedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Album));
      setAlbums(fetchedAlbums);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error fetching albums:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, sortBy]);

  useEffect(() => {
    fetchInitialAlbums();
  }, [fetchInitialAlbums]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowCookieConsent(true);
    }
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowCookieConsent(false);
  };

  // Load more
  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      let q;
      if (sortBy === 'discount') {
        if (selectedGenre !== "All") {
          q = query(
            collection(db, 'albums'),
            where('genre', '==', selectedGenre),
            where('discount', '>', 0),
            orderBy('discount', 'desc'),
            startAfter(lastDoc),
            limit(20)
          );
        } else {
          q = query(
            collection(db, 'albums'),
            where('discount', '>', 0),
            orderBy('discount', 'desc'),
            startAfter(lastDoc),
            limit(20)
          );
        }
      } else {
        const orderField = 'createdAt';
        const orderDirection = sortBy === 'oldest' ? 'asc' : 'desc';
        if (selectedGenre !== "All") {
          q = query(
            collection(db, 'albums'),
            where('genre', '==', selectedGenre),
            orderBy(orderField, orderDirection),
            startAfter(lastDoc),
            limit(20)
          );
        } else {
          q = query(
            collection(db, 'albums'),
            orderBy(orderField, orderDirection),
            startAfter(lastDoc),
            limit(20)
          );
        }
      }

      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'albums'));
      if (!snapshot) return;
      const newAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Album));
      
      setAlbums(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNew = newAlbums.filter(a => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      });
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error loading more albums:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore, hasMore, selectedGenre, sortBy]);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadingMore, loadMore]);

  const openAddModal = useCallback(() => {
    setNewAlbum({
      title: "",
      artist: "",
      genre: genres.length > 1 ? genres[1] : "",
      year: new Date().getFullYear(),
      price: 19.99,
      discount: 0,
      coverUrl: "",
      description: "",
      purchaseUrl: "",
      tracklist: "",
      tracksCount: 0,
      audioUrl: ""
    });
    setEditingAlbumId(null);
    setShowDeleteConfirm(false);
    setImageFile(null);
    setAudioFile(null);
    setOriginalAudioUrl(null);
    setOriginalCoverUrl(null);
    setAddError(null);
    setShowAddModal(true);
  }, [genres]);

  const openEditModal = useCallback((album: Album) => {
    setNewAlbum({
      title: album.title,
      artist: album.artist,
      genre: album.genre,
      year: album.year,
      price: album.price,
      discount: album.discount || 0,
      coverUrl: album.coverUrl,
      description: album.description || "",
      purchaseUrl: album.purchaseUrl || "",
      tracklist: album.tracklist || "",
      tracksCount: album.tracksCount || 0,
      audioUrl: album.audioUrl || ""
    });
    setEditingAlbumId(album.id);
    setShowDeleteConfirm(false);
    setImageFile(null);
    setAudioFile(null);
    setOriginalAudioUrl(album.audioUrl || null);
    setOriginalCoverUrl(album.coverUrl || null);
    setAddError(null);
    setShowAddModal(true);
  }, []);

  // Handle Save Album (Add or Edit)
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    setAddError(null);
    setLoadingMore(true);
    try {
      let coverUrl = newAlbum.coverUrl;
      if (imageFile) {
        if (originalCoverUrl) {
          try { await deleteObject(ref(storage, originalCoverUrl)); } catch (err) { console.error("Failed to delete old cover", err); }
        }
        const storageRef = ref(storage, `covers/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        coverUrl = await getDownloadURL(storageRef);
      } else if (!newAlbum.coverUrl && originalCoverUrl) {
        try { await deleteObject(ref(storage, originalCoverUrl)); } catch (err) { console.error("Failed to delete old cover", err); }
        coverUrl = "";
      }

      let audioUrl = newAlbum.audioUrl;
      if (audioFile) {
        if (originalAudioUrl) {
          try { await deleteObject(ref(storage, originalAudioUrl)); } catch (err) { console.error("Failed to delete old audio", err); }
        }
        const storageRef = ref(storage, `audio/${Date.now()}_${audioFile.name}`);
        await uploadBytes(storageRef, audioFile);
        audioUrl = await getDownloadURL(storageRef);
      } else if (!newAlbum.audioUrl && originalAudioUrl) {
        try { await deleteObject(ref(storage, originalAudioUrl)); } catch (err) { console.error("Failed to delete old audio", err); }
        audioUrl = "";
      }

      if (editingAlbumId) {
        await updateDoc(doc(db, 'albums', editingAlbumId), {
          ...newAlbum,
          coverUrl,
          audioUrl
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `albums/${editingAlbumId}`));
      } else {
        await addDoc(collection(db, 'albums'), {
          ...newAlbum,
          coverUrl,
          audioUrl,
          createdAt: serverTimestamp(),
          stock: 100
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'albums'));
      }
      
      setShowAddModal(false);
      setImageFile(null);
      setAudioFile(null);
      fetchInitialAlbums();
    } catch (error: any) {
      console.error("Error saving album:", error);
      let errorMessage = "Failed to save album. Please check console for details.";
      if (error instanceof Error && error.message && error.message !== "undefined" && error.message.trim() !== "") {
        try {
          // Check if the message looks like JSON before parsing
          const trimmedMessage = error.message.trim();
          if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[')) {
            const parsed = JSON.parse(trimmedMessage);
            errorMessage = parsed.error || errorMessage;
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      setAddError(errorMessage);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle Save Genre
  const handleSaveGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newGenreName.trim()) return;
    
    setLoadingMore(true);
    try {
      await addDoc(collection(db, 'genres'), {
        name: newGenreName.trim(),
        createdAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'genres'));
      
      setShowAddGenreModal(false);
      setNewGenreName("");
    } catch (error) {
      console.error("Error adding genre:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle Delete Album
  const handleDeleteAlbum = async () => {
    if (!isAdmin || !editingAlbumId) return;
    
    setLoadingMore(true);
    try {
      const albumToDelete = albums.find(a => a.id === editingAlbumId);
      if (albumToDelete) {
        if (albumToDelete.coverUrl) {
          try { await deleteObject(ref(storage, albumToDelete.coverUrl)); } catch (err) { console.error("Failed to delete cover", err); }
        }
        if (albumToDelete.audioUrl) {
          try { await deleteObject(ref(storage, albumToDelete.audioUrl)); } catch (err) { console.error("Failed to delete audio", err); }
        }
      }

      await deleteDoc(doc(db, 'albums', editingAlbumId)).catch(err => handleFirestoreError(err, OperationType.DELETE, `albums/${editingAlbumId}`));
      setShowAddModal(false);
      setImageFile(null);
      setAudioFile(null);
      fetchInitialAlbums();
    } catch (error: any) {
      console.error("Error deleting album:", error);
      let errorMessage = "Failed to delete album. Please check console for details.";
      if (error instanceof Error && error.message && error.message !== "undefined" && error.message.trim() !== "") {
        try {
          // Check if the message looks like JSON before parsing
          const trimmedMessage = error.message.trim();
          if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[')) {
            const parsed = JSON.parse(trimmedMessage);
            errorMessage = parsed.error || errorMessage;
          } else {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      setAddError(errorMessage);
    } finally {
      setLoadingMore(false);
    }
  };

  // Seed data function
  const seedData = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    try {
      const defaultGenres = ["Rock", "Jazz", "Electronic", "Hip Hop", "Classical", "Pop", "Blues"];
      for (const genre of defaultGenres) {
        if (!genres.includes(genre)) {
          await addDoc(collection(db, 'genres'), {
            name: genre,
            createdAt: serverTimestamp()
          });
        }
      }

      const sampleAlbums = [
        { title: "Midnight City", artist: "Neon Dreams", genre: "Electronic", year: 2023, price: 24.99, coverUrl: "https://picsum.photos/seed/elec1/600/600", stock: 50, description: "A journey through the neon-lit streets of a future city." },
        { title: "Echoes of Silence", artist: "The Void", genre: "Rock", year: 2022, price: 19.99, coverUrl: "https://picsum.photos/seed/rock1/600/600", stock: 30, description: "Raw energy and haunting melodies." },
        { title: "Blue Note Sessions", artist: "Jazz Quartet", genre: "Jazz", year: 2021, price: 29.99, coverUrl: "https://picsum.photos/seed/jazz1/600/600", stock: 15, description: "Classic jazz recorded live in a smoky basement club." },
        { title: "Urban Pulse", artist: "Street Kings", genre: "Hip Hop", year: 2024, price: 22.50, coverUrl: "https://picsum.photos/seed/hiphop1/600/600", stock: 100, description: "The heartbeat of the city in every beat." },
        { title: "Symphony No. 5", artist: "Vienna Philharmonic", genre: "Classical", year: 2020, price: 35.00, coverUrl: "https://picsum.photos/seed/class1/600/600", stock: 20, description: "A masterpiece of classical music." },
        { title: "Summer Vibes", artist: "Pop Stars", genre: "Pop", year: 2023, price: 15.99, coverUrl: "https://picsum.photos/seed/pop1/600/600", stock: 200, description: "The soundtrack to your perfect summer." },
        { title: "Delta Blues", artist: "Old Soul", genre: "Blues", year: 2019, price: 18.00, coverUrl: "https://picsum.photos/seed/blues1/600/600", stock: 40, description: "Authentic blues from the heart of the Delta." },
        { title: "Electric Sky", artist: "Synth Wave", genre: "Electronic", year: 2024, price: 26.00, coverUrl: "https://picsum.photos/seed/elec2/600/600", stock: 60, description: "Retro-futuristic sounds for the modern age." },
      ];

      for (const album of sampleAlbums) {
        await addDoc(collection(db, 'albums'), {
          ...album,
          createdAt: serverTimestamp()
        });
      }
      fetchInitialAlbums();
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredAlbums = useMemo(() => {
    if (!searchQuery) return albums;
    const lowerQuery = searchQuery.toLowerCase();
    return albums.filter(album => 
      album.title.toLowerCase().includes(lowerQuery) ||
      album.artist.toLowerCase().includes(lowerQuery)
    );
  }, [albums, searchQuery]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500 selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <button 
            onClick={() => {
              setSearchQuery("");
              setSelectedGenre("All");
              setSortBy("newest");
              setSelectedAlbum(null);
              setShowNewArrivalsModal(false);
              setShowGenresCloud(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity text-left"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-orange-500 rounded-full flex items-center justify-center">
              <Disc className="text-black w-4 h-4 md:w-6 md:h-6 animate-spin-slow" />
            </div>
            <span className="text-sm md:text-xl font-bold tracking-tighter uppercase italic leading-tight">Музыка без штрафов</span>
          </button>

          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => setShowNewArrivalsModal(true)} className="text-sm uppercase tracking-widest font-semibold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2">
              <CustomStarIcon className="w-5 h-5" /> НОВЫЕ ПОСТУПЛЕНИЯ
            </button>
            <button onClick={() => setShowGenresCloud(true)} className="text-sm uppercase tracking-widest font-semibold opacity-60 hover:opacity-100 transition-opacity">ЖАНРЫ</button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                {isAdmin && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowAddGenreModal(true)}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all"
                      title="Add Genre"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="hidden sm:inline">Add Genre</span>
                      <span className="sm:hidden">Genre</span>
                    </button>
                    <button 
                      onClick={openAddModal}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all"
                      title="Add Album"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="hidden sm:inline">Add Album</span>
                      <span className="sm:hidden">Add</span>
                    </button>
                    <button 
                      onClick={seedData}
                      disabled={isSeeding}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                      title="Seed Data"
                    >
                      {isSeeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      <span className="hidden sm:inline">Seed</span>
                      <span className="sm:hidden">Seed</span>
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => signOut()}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" referrerPolicy="no-referrer" />
                </div>
              </div>
            ) : (
              <button 
                onClick={() => signIn()}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-full transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <UserIcon className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-orange-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <span className="text-orange-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">Premium Audio for Business</span>
            <h1 className="text-5xl sm:text-7xl md:text-[90px] lg:text-[120px] font-black leading-[0.85] tracking-tighter uppercase mb-6 md:mb-8 text-center break-words w-full">
              The Sound <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/50 to-white/10">Of Tomorrow</span>
            </h1>
            <p className="max-w-3xl text-white/50 text-sm md:text-lg mb-8 md:mb-12 text-center px-4">
              Каталог музыкальных композиций, который можно использовать<br className="hidden md:block" />
              в любом вашем заведении. В одном месте вы приобретаете<br className="hidden md:block" />
              музыку и больше не платите ни за какие подписки.
            </p>

            <div className="w-full max-w-2xl relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Поиск по исполнителю, альбому или жанру..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-16 bg-white/5 border border-white/10 rounded-full pl-16 pr-8 text-lg focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-20 z-40 bg-black/80 backdrop-blur-md border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto h-full">
            {genres.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  "px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all shrink-0",
                  selectedGenre === genre 
                    ? "bg-white text-black" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
          <div className="relative flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest shrink-0 ml-4" ref={sortRef}>
            <Filter className="w-3 h-3" />
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="bg-transparent border-none outline-none cursor-pointer text-white/60 hover:text-white transition-colors flex items-center gap-1"
            >
              {sortBy === 'newest' && 'Сортировка: НОВЫЕ'}
              {sortBy === 'oldest' && 'Сортировка: СТАРЫЕ'}
              {sortBy === 'discount' && 'Сортировка: СКИДКА'}
              <ChevronDown className={cn("w-3 h-3 transition-transform", isSortOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {isSortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="flex flex-col">
                    <button
                      onClick={() => { setSortBy('newest'); setIsSortOpen(false); }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5",
                        sortBy === 'newest' ? "text-orange-500 bg-white/5" : "text-white/60"
                      )}
                    >
                      Сортировка: НОВЫЕ
                    </button>
                    <button
                      onClick={() => { setSortBy('oldest'); setIsSortOpen(false); }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5",
                        sortBy === 'oldest' ? "text-orange-500 bg-white/5" : "text-white/60"
                      )}
                    >
                      Сортировка: СТАРЫЕ
                    </button>
                    <button
                      onClick={() => { setSortBy('discount'); setIsSortOpen(false); }}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5",
                        sortBy === 'discount' ? "text-orange-500 bg-white/5" : "text-white/60"
                      )}
                    >
                      Сортировка: СКИДКА
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Album Grid */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <span className="text-white/40 uppercase tracking-widest text-xs font-bold">ЗАГРУЖАЕМ...</span>
          </div>
        ) : filteredAlbums.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
            {filteredAlbums.map((album, index) => (
              <AlbumCard key={album.id} album={album} index={index} isAdmin={isAdmin} onEdit={openEditModal} onSelect={setSelectedAlbum} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Search className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Альбомы не найдены</h3>
            <p className="text-white/40">Попробуйте изменить параметры поиска или фильтры.</p>
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-20">
          {loadingMore && (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Загружаем еще...</span>
            </div>
          )}
          {!hasMore && albums.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Скоро будет ещё...</span>
          )}
        </div>
      </main>

      {/* Add Album Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-3xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold uppercase tracking-tighter">
                  {editingAlbumId ? "Edit Album" : "Add New Album"}
                </h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {addError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium">
                  {addError}
                </div>
              )}

              <form onSubmit={handleSaveAlbum} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Album Title</label>
                    <input 
                      required
                      type="text" 
                      value={newAlbum.title}
                      onChange={e => setNewAlbum({...newAlbum, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      placeholder="e.g. Dark Side of the Moon"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Artist</label>
                    <input 
                      required
                      type="text" 
                      value={newAlbum.artist}
                      onChange={e => setNewAlbum({...newAlbum, artist: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      placeholder="e.g. Pink Floyd"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Genre</label>
                      <CustomSelect 
                        value={newAlbum.genre}
                        onChange={(val) => setNewAlbum({...newAlbum, genre: val})}
                        options={genres.slice(1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Year</label>
                      <input 
                        type="number" 
                        value={newAlbum.year}
                        onChange={e => setNewAlbum({...newAlbum, year: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Треки</label>
                      <input 
                        type="number" 
                        min="0"
                        value={newAlbum.tracksCount || 0}
                        onChange={e => setNewAlbum({...newAlbum, tracksCount: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Цена (₽)</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={newAlbum.price}
                        onChange={e => setNewAlbum({...newAlbum, price: parseFloat(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Скидка (%)</label>
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        value={newAlbum.discount || 0}
                        onChange={e => setNewAlbum({...newAlbum, discount: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Cover Image Upload</label>
                    <input 
                      required={!newAlbum.coverUrl}
                      type="file" 
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setImageFile(e.target.files[0]);
                        } else {
                          setImageFile(null);
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Audio Snippet Upload (Optional)</label>
                    <input 
                      type="file" 
                      accept="audio/mpeg, audio/wav, audio/ogg"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setAudioFile(e.target.files[0]);
                        } else {
                          setAudioFile(null);
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
                    />
                    {newAlbum.audioUrl && !audioFile && (
                      <div className="flex items-center justify-between mt-2 bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="text-xs font-bold text-green-500">Аудиофайл загружен</span>
                        <button
                          type="button"
                          onClick={() => setNewAlbum({ ...newAlbum, audioUrl: "" })}
                          className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                    <textarea 
                      value={newAlbum.description}
                      onChange={e => setNewAlbum({...newAlbum, description: e.target.value})}
                      className="w-full h-[104px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                      placeholder="Tell us about this masterpiece..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Purchase Link (URL)</label>
                    <input 
                      type="url"
                      value={newAlbum.purchaseUrl}
                      onChange={e => setNewAlbum({...newAlbum, purchaseUrl: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                      placeholder="https://example.com/buy"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tracklist (One track per line)</label>
                    <textarea 
                      value={newAlbum.tracklist}
                      onChange={e => setNewAlbum({...newAlbum, tracklist: e.target.value})}
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                      placeholder="1. Track One&#10;2. Track Two"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 mt-4 flex flex-col sm:flex-row gap-4">
                  {editingAlbumId && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (showDeleteConfirm) {
                          handleDeleteAlbum();
                        } else {
                          setShowDeleteConfirm(true);
                        }
                      }}
                      disabled={loadingMore}
                      className={`w-full sm:w-1/3 py-4 font-bold uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                        showDeleteConfirm 
                          ? "bg-red-600 hover:bg-red-700 text-white" 
                          : "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {showDeleteConfirm ? "Подтвердить" : "Удалить"}
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={loadingMore}
                    className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {editingAlbumId ? "Saving..." : "Adding..."}
                      </>
                    ) : (
                      editingAlbumId ? "Save Changes" : "Add to Vault"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Arrivals Modal */}
      <AnimatePresence>
        {showNewArrivalsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowNewArrivalsModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-5xl bg-[#111] border border-white/10 rounded-3xl p-6 md:p-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-tighter italic">
                  Новые Поступления
                </h2>
                <button 
                  onClick={() => setShowNewArrivalsModal(false)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto custom-scrollbar pr-2">
                {loadingNewArrivals ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {newArrivals.map((album) => (
                      <div 
                        key={album.id} 
                        className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedAlbum(album);
                          setShowNewArrivalsModal(false);
                        }}
                      >
                        <div className="aspect-square overflow-hidden relative">
                          <img 
                            src={album.coverUrl || "https://picsum.photos/seed/vinyl/600/600"} 
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <span className="text-xs font-bold uppercase tracking-widest bg-orange-500 text-black px-3 py-1.5 rounded-full">
                              ОПИСАНИЕ АЛЬБОМА
                            </span>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="min-w-0">
                              <h3 className="font-bold text-lg leading-tight mb-1 truncate">{album.title}</h3>
                              <div className="flex items-baseline gap-2">
                                <p className="text-sm text-white/60 truncate">{album.artist}</p>
                                {album.tracksCount ? (
                                  <span className="text-[10px] font-bold text-white/30 whitespace-nowrap shrink-0">({album.tracksCount} треков)</span>
                                ) : null}
                              </div>
                            </div>
                            {album.discount && album.discount > 0 ? (
                              <div className="flex flex-col items-end shrink-0">
                                <span className="font-mono text-white/40 font-bold line-through text-xs">{album.price} ₽</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-orange-500 text-black px-1.5 h-4 flex items-center justify-center rounded font-bold leading-none">-{album.discount}%</span>
                                  <span className="font-mono text-orange-500 font-bold">{Math.round(album.price * (1 - album.discount / 100))} ₽</span>
                                </div>
                              </div>
                            ) : (
                              <span className="font-mono text-orange-500 font-bold shrink-0">{album.price} ₽</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white/10 rounded-md">
                              {album.genre}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white/10 rounded-md">
                              {album.year}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Genres Cloud Modal */}
      <AnimatePresence>
        {showGenresCloud && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowGenresCloud(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-4xl bg-[#111] border border-white/10 rounded-3xl p-8 md:p-12 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter">
                  Все Жанры
                </h2>
                <button 
                  onClick={() => setShowGenresCloud(false)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3 md:gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {genres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => {
                      setSelectedGenre(genre);
                      setShowGenresCloud(false);
                    }}
                    className={cn(
                      "px-6 py-3 rounded-full text-sm md:text-base font-bold uppercase tracking-widest transition-all border",
                      selectedGenre === genre 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-white/70 border-white/20 hover:border-white/60 hover:text-white"
                    )}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Genre Modal */}
      <AnimatePresence>
        {showAddGenreModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowAddGenreModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold uppercase tracking-tighter">
                  Add New Genre
                </h2>
                <button 
                  onClick={() => setShowAddGenreModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGenre} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Genre Name</label>
                  <input 
                    type="text" 
                    required
                    value={newGenreName}
                    onChange={e => setNewGenreName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="e.g. Synthwave"
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button 
                    type="submit"
                    disabled={loadingMore || !newGenreName.trim()}
                    className="px-8 py-3 bg-white text-black rounded-full text-xs font-bold uppercase tracking-widest hover:bg-orange-500 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? "Saving..." : "Save Genre"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Album Details Modal */}
      <AnimatePresence>
        {selectedAlbum && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAlbum(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#111] border border-white/10 rounded-3xl p-6 md:p-10 no-scrollbar"
            >
              <button 
                onClick={() => setSelectedAlbum(null)}
                className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-white/10 rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-6">
                  <div className="aspect-square rounded-2xl overflow-hidden border border-white/10">
                    <img 
                      src={selectedAlbum.coverUrl} 
                      alt={selectedAlbum.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {selectedAlbum.purchaseUrl && (
                    <a 
                      href={selectedAlbum.purchaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-black font-bold uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-5 h-5" /> Купить альбом
                    </a>
                  )}
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      {selectedAlbum.discount && selectedAlbum.discount > 0 ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="h-7 px-3 flex items-center justify-center bg-orange-500 text-black rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg leading-none">
                            -{selectedAlbum.discount}%
                          </span>
                          <span className="text-sm font-bold uppercase tracking-widest line-through text-white/40 whitespace-nowrap">
                            {selectedAlbum.price} ₽
                          </span>
                          <span className="text-xl font-bold uppercase tracking-widest text-orange-500 whitespace-nowrap">
                            {Math.round(selectedAlbum.price * (1 - selectedAlbum.discount / 100))} ₽
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold uppercase tracking-widest text-white shrink-0 whitespace-nowrap">
                          {selectedAlbum.price} ₽
                        </span>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0">
                          {selectedAlbum.genre}
                        </span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0">
                          {selectedAlbum.year}
                        </span>
                      </div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">
                      {selectedAlbum.title}
                    </h2>
                    <div className="flex items-center gap-3">
                      <p className="text-xl md:text-2xl text-white/60 font-medium">
                        {selectedAlbum.artist}
                      </p>
                      {selectedAlbum.tracksCount ? (
                        <span className="text-sm font-bold text-white/30 bg-white/5 px-3 py-1 rounded-full">
                          {selectedAlbum.tracksCount} треков
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {selectedAlbum.audioUrl && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Превью</h3>
                      <CustomAudioPlayer url={selectedAlbum.audioUrl} />
                    </div>
                  )}

                  {selectedAlbum.description && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Описание</h3>
                      <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                        {selectedAlbum.description}
                      </p>
                    </div>
                  )}

                  {selectedAlbum.tracklist && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Треклист</h3>
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <ul className="space-y-2">
                          {selectedAlbum.tracklist.split('\n').map((track, i) => track.trim() ? (
                            <li key={i} className="text-sm text-white/80 flex gap-3">
                              <span className="text-white/30 w-4 text-right">{i + 1}.</span>
                              <span>{track.replace(/^\d+[\.\)]\s*/, '')}</span>
                            </li>
                          ) : null)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-8">
            <button 
              onClick={() => {
                setSearchQuery("");
                setSelectedGenre("All");
                setSortBy("newest");
                setSelectedAlbum(null);
                setShowNewArrivalsModal(false);
                setShowGenresCloud(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <Disc className="text-black w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase italic">Музыка без штрафов</span>
            </button>
            <p className="max-w-md text-white/40 leading-relaxed">
              Музыка без штрафов — это премиальное место для владельцев разных заведений. Мы специализируемся на высококачественном аудио для воспроизведения музыкальных композиций БЕЗ ШТРАФА.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">Контакты</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="https://vk.com/musicfines" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition-colors">VK</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">
            © 2026 <a href="https://vk.com/musicfines" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline underline-offset-4">Музыка без штрафов</a>. Все права защищены.
          </p>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-white/20">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-50 p-4 bg-orange-500 text-black rounded-full shadow-lg shadow-orange-500/20 hover:bg-orange-400 transition-colors"
          >
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cookie Consent */}
      <AnimatePresence>
        {showCookieConsent && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-[400px] z-[100] bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Cookie className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2">Файлы Cookie</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Мы используем файлы cookie для улучшения работы сайта, анализа трафика и персонализации контента в соответствии с законодательством РФ. Продолжая использовать сайт, вы соглашаетесь с нашей политикой.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAcceptCookies}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black text-[10px] font-bold uppercase tracking-widest py-3 px-4 rounded-xl transition-colors"
              >
                Принять
              </button>
              <a
                href="#"
                className="flex-1 text-center bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest py-3 px-4 rounded-xl transition-colors border border-white/5"
              >
                Подробнее
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
