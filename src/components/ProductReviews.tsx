import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MessageSquare, Send, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, QuerySnapshot, DocumentData } from 'firebase/firestore';

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
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Firestore Error: ', error);
  throw new Error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }));
}

interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ProductReviewsProps {
  productId: string;
  user: { name: string; email: string; uid: string } | null;
  onLoginPrompt: () => void;
}

export default function ProductReviews({ productId, user, onLoginPrompt }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const reviewData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString()
      })) as Review[];
      setReviews(reviewData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reviews');
    });

    return () => unsubscribe();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onLoginPrompt();
      return;
    }

    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        productId,
        userId: user.uid,
        userName: user.name,
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      
      setComment('');
      setRating(5);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="mt-16 sm:mt-24 border-t border-white/5 pt-16 sm:pt-24 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
        <div>
          <span className="text-[10px] font-black tracking-[0.6em] text-accent uppercase mb-2 block">Engagement_Manifest</span>
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">Archival Feedback</h2>
          {averageRating && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-4 h-4 ${Number(averageRating) >= s ? 'fill-accent text-accent' : 'text-white/10'}`} />
                ))}
              </div>
              <span className="text-xl font-mono font-bold">{averageRating}</span>
              <span className="text-[10px] font-mono text-muted uppercase tracking-widest">/ {reviews.length} manifestations</span>
            </div>
          )}
        </div>

        {!user && (
          <button 
            onClick={onLoginPrompt}
            className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-6 py-3 hover:bg-white hover:text-bg transition-all"
          >
            Authorize to leave feedback
          </button>
        )}
      </div>

      {user && (
        <form onSubmit={handleSubmit} className="mb-20 bg-surface/30 border border-white/5 p-6 sm:p-10 relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-20 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex flex-col sm:flex-row gap-6 mb-8">
            <div className="space-y-3 shrink-0">
              <label className="text-[9px] font-black uppercase text-muted tracking-widest block">Engagement Level</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoveredRating(s)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="p-1 transition-transform hover:scale-125"
                  >
                    <Star className={`w-6 h-6 ${(hoveredRating || rating) >= s ? 'fill-accent text-accent' : 'text-white/10'}`} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 space-y-3">
              <label className="text-[9px] font-black uppercase text-muted tracking-widest block">Detailed Manifest</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Log your experience with this archival piece..."
                className="w-full bg-bg/50 border border-white/10 p-4 text-xs font-mono focus:border-accent outline-none min-h-[120px] resize-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted uppercase">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Identity Verified: {user.name}</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent text-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-bg transition-all flex items-center gap-3"
            >
              {isSubmitting ? 'Syncing...' : 'Dispatch Feedback'}
              <Send className="w-3 h-3" />
            </button>
          </div>
        </form>
      )}

      <div className="space-y-12">
        {reviews.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 opacity-30">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 stroke-1" />
            <p className="text-[10px] font-black uppercase tracking-widest">No archival feedback detected in this sector.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface border border-white/10 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-accent opacity-50" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">{review.userName}</h4>
                    <span className="text-[10px] font-mono text-muted uppercase">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${review.rating >= s ? 'fill-accent text-accent' : 'text-white/10'}`} />
                    ))}
                  </div>
                  {user?.uid === review.userId && (
                    <button 
                      onClick={() => handleDelete(review.id)}
                      className="text-muted hover:text-accent transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="pl-14">
                <p className="text-xs font-mono text-muted leading-relaxed max-w-2xl italic">
                  "{review.comment}"
                </p>
                <div className="mt-4 h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent" />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
