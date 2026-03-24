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
  doc,
  serverTimestamp,
  where,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  Info
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
  createdAt: any;
}

const GENRES = ["All", "Rock", "Jazz", "Electronic", "Hip Hop", "Classical", "Pop", "Blues"];

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
      <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest">{album.price} ₽</span>
      </div>
    </div>
    
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">{album.genre}</span>
        <span className="text-[10px] font-bold text-white/30">{album.year}</span>
      </div>
      <h3 className="text-lg font-bold truncate group-hover:text-orange-500 transition-colors">{album.title}</h3>
      <p className="text-sm text-white/40 font-medium">{album.artist}</p>
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

export default function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  
  // Form State
  const [newAlbum, setNewAlbum] = useState({
    title: "",
    artist: "",
    genre: "Rock",
    year: new Date().getFullYear(),
    price: 19.99,
    coverUrl: "",
    description: "",
    purchaseUrl: "",
    tracklist: ""
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

  // Initial fetch
  const fetchInitialAlbums = useCallback(async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'albums'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (selectedGenre !== "All") {
        q = query(
          collection(db, 'albums'),
          where('genre', '==', selectedGenre),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }

      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'albums'));
      if (!snapshot) return;
      const fetchedAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Album));
      setAlbums(fetchedAlbums);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error fetching albums:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre]);

  useEffect(() => {
    fetchInitialAlbums();
  }, [fetchInitialAlbums]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      let q = query(
        collection(db, 'albums'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(20)
      );

      if (selectedGenre !== "All") {
        q = query(
          collection(db, 'albums'),
          where('genre', '==', selectedGenre),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(20)
        );
      }

      const snapshot = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'albums'));
      if (!snapshot) return;
      const newAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Album));
      
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
  }, [lastDoc, loadingMore, hasMore, selectedGenre]);

  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadingMore, loadMore]);

  const openAddModal = useCallback(() => {
    setNewAlbum({
      title: "",
      artist: "",
      genre: "Rock",
      year: new Date().getFullYear(),
      price: 19.99,
      coverUrl: "",
      description: "",
      purchaseUrl: "",
      tracklist: ""
    });
    setEditingAlbumId(null);
    setImageFile(null);
    setAddError(null);
    setShowAddModal(true);
  }, []);

  const openEditModal = useCallback((album: Album) => {
    setNewAlbum({
      title: album.title,
      artist: album.artist,
      genre: album.genre,
      year: album.year,
      price: album.price,
      coverUrl: album.coverUrl,
      description: album.description || "",
      purchaseUrl: album.purchaseUrl || "",
      tracklist: album.tracklist || ""
    });
    setEditingAlbumId(album.id);
    setImageFile(null);
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
        const storageRef = ref(storage, `covers/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        coverUrl = await getDownloadURL(storageRef);
      }

      if (editingAlbumId) {
        await updateDoc(doc(db, 'albums', editingAlbumId), {
          ...newAlbum,
          coverUrl
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `albums/${editingAlbumId}`));
      } else {
        await addDoc(collection(db, 'albums'), {
          ...newAlbum,
          coverUrl,
          createdAt: serverTimestamp(),
          stock: 100
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'albums'));
      }
      
      setShowAddModal(false);
      setImageFile(null);
      fetchInitialAlbums();
    } catch (error: any) {
      console.error("Error saving album:", error);
      let errorMessage = "Failed to save album. Please check console for details.";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          errorMessage = parsed.error || errorMessage;
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
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-orange-500 rounded-full flex items-center justify-center">
              <Disc className="text-black w-4 h-4 md:w-6 md:h-6 animate-spin-slow" />
            </div>
            <span className="text-sm md:text-xl font-bold tracking-tighter uppercase italic leading-tight">Музыка без штрафов</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#" className="text-sm uppercase tracking-widest font-semibold opacity-60 hover:opacity-100 transition-opacity">КАТАЛОГ</a>
            <a href="#" className="text-sm uppercase tracking-widest font-semibold opacity-60 hover:opacity-100 transition-opacity">НОВЫЕ ПОСТУПЛЕНИЯ</a>
            <a href="#" className="text-sm uppercase tracking-widest font-semibold opacity-60 hover:opacity-100 transition-opacity">ЖАНРЫ</a>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                {isAdmin && (
                  <div className="flex gap-2">
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
            <span className="text-orange-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] mb-4 md:mb-6 text-center">Premium Audio Experience</span>
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
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {GENRES.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  "px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                  selectedGenre === genre 
                    ? "bg-white text-black" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-white/40 text-xs font-bold uppercase tracking-widest min-w-max ml-8">
            <Filter className="w-3 h-3" />
            Sort by: Newest
          </div>
        </div>
      </div>

      {/* Album Grid */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <span className="text-white/40 uppercase tracking-widest text-xs font-bold">Loading Vault...</span>
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
            <h3 className="text-2xl font-bold mb-2">No albums found</h3>
            <p className="text-white/40">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-20">
          {loadingMore && (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Loading more...</span>
            </div>
          )}
          {!hasMore && albums.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">End of catalog</span>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Genre</label>
                      <select 
                        value={newAlbum.genre}
                        onChange={e => setNewAlbum({...newAlbum, genre: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors appearance-none"
                      >
                        {GENRES.slice(1).map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
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
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Price (₽)</label>
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

                <div className="md:col-span-2 mt-4">
                  <button 
                    type="submit"
                    disabled={loadingMore}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {selectedAlbum.genre}
                      </span>
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {selectedAlbum.year}
                      </span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">
                      {selectedAlbum.title}
                    </h2>
                    <p className="text-xl md:text-2xl text-white/60 font-medium">
                      {selectedAlbum.artist}
                    </p>
                  </div>

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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <Disc className="text-black w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase italic">Музыка без штрафов</span>
            </div>
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">© 2026 Музыка без штрафов. Все права защищены.</p>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-white/20">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

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
