import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { CommunityPost } from '@/types';
import { createCommunityPost, fetchCommunityPosts, togglePostLike } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Share2, Plus, Search, TrendingUp, Loader2 } from 'lucide-react';

const Community = () => {
  const { user, userNGO } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [open, setOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCommunityPosts();
      setPosts(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to load community', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = posts.filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase())
  );

  const handlePublish = async () => {
    if (!user?.id || !newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      await createCommunityPost({
        userId: user.id,
        ngoId: userNGO?.id,
        title: newPost.title.trim(),
        content: newPost.content.trim(),
      });
      setNewPost({ title: '', content: '' });
      setOpen(false);
      toast({ title: 'Post published!' });
      await load();
    } catch (err: unknown) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (!user?.id) return;
    try {
      await togglePostLike(post.id, user.id, Boolean(post.likedByMe));
      setPosts(prev =>
        prev.map(p =>
          p.id === post.id
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likes: p.likedByMe ? Math.max(0, p.likes - 1) : p.likes + 1,
              }
            : p
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const trending = Array.from(
    new Set(posts.flatMap(p => p.tags).filter(Boolean))
  ).slice(0, 6);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Community</h1>
            <p className="text-muted-foreground">Connect with other NGOs and share experiences</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Post title"
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                />
                <Textarea
                  placeholder="Share your thoughts..."
                  rows={4}
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                />
                <Button className="w-full" onClick={handlePublish} disabled={publishing}>
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Publish
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No posts yet. Be the first!</p>
            ) : (
              filtered.map(post => (
                <Card key={post.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={post.userAvatar} />
                        <AvatarFallback>{post.userName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{post.userName}</span>
                          <span className="text-muted-foreground text-sm">• {post.ngoName}</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">{post.title}</h3>
                        <p className="text-muted-foreground mb-4">{post.content}</p>
                        {post.tags.length > 0 && (
                          <div className="flex gap-2 mb-4 flex-wrap">
                            {post.tags.map(tag => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-6 text-muted-foreground">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLike(post)}
                            className={post.likedByMe ? 'text-destructive' : ''}
                          >
                            <Heart
                              className={`mr-1 h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`}
                            />
                            {post.likes}
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessageCircle className="mr-1 h-4 w-4" />
                            {post.comments}
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Share2 className="mr-1 h-4 w-4" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(trending.length ? trending : ['CareTips', 'Vaccination', 'Adoption', 'DogHealth']).map(
                  tag => (
                    <Button key={tag} variant="ghost" className="w-full justify-start">
                      #{tag.replace(/^#/, '')}
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Community;
