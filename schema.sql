-- ============================================================
-- CupidCampus 数据库建表脚本（可重复执行）
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 1. 用户资料表（关联 Supabase Auth）
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname          TEXT NOT NULL,
  gender            TEXT,
  grade             TEXT,
  school            TEXT DEFAULT '未填写',
  major             TEXT DEFAULT '未填写',
  location          TEXT DEFAULT '未填写',
  mbti              TEXT,
  bio               TEXT DEFAULT '这个人很懒，什么都没写...',
  avatar            TEXT DEFAULT '🌸',
  photo_url         TEXT,
  hobbies           TEXT[] DEFAULT '{}',
  match_pref        JSONB DEFAULT '{}',
  points            INTEGER DEFAULT 0,
  is_vip            BOOLEAN DEFAULT FALSE,
  vip_expire        TIMESTAMPTZ,
  daily_likes_used  INTEGER DEFAULT 0,
  daily_likes_date  TEXT,
  profile_bonus     BOOLEAN DEFAULT FALSE,
  last_login        TEXT,
  inventory         JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 喜欢记录
CREATE TABLE IF NOT EXISTS likes (
  id         BIGSERIAL PRIMARY KEY,
  liker_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  liked_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liker_id, liked_id)
);

-- 3. 匹配记录
CREATE TABLE IF NOT EXISTS matches (
  id         BIGSERIAL PRIMARY KEY,
  user_a     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_b     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_match ON matches(
  LEAST(user_a, user_b),
  GREATEST(user_a, user_b)
);

-- 4. 聊天消息
CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  sender_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  gift_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  created_at DESC
);

-- 5. 校园圈帖子
CREATE TABLE IF NOT EXISTS posts (
  id         BIGSERIAL PRIMARY KEY,
  author_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT,
  images     TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_time ON posts(created_at DESC);

-- 6. 帖子评论
CREATE TABLE IF NOT EXISTS comments (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);

-- 7. 帖子点赞
CREATE TABLE IF NOT EXISTS post_likes (
  id      BIGSERIAL PRIMARY KEY,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(post_id, user_id)
);

-- 8. 匿名提问
CREATE TABLE IF NOT EXISTS questions (
  id          BIGSERIAL PRIMARY KEY,
  to_user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  from_name   TEXT DEFAULT '匿名同学',
  question    TEXT NOT NULL,
  answer      TEXT,
  answer_type TEXT,
  answer_time TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 举报
CREATE TABLE IF NOT EXISTS reports (
  id          BIGSERIAL PRIMARY KEY,
  target_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT,
  reason_label TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 礼物库存
CREATE TABLE IF NOT EXISTS gift_inventory (
  id        BIGSERIAL PRIMARY KEY,
  owner_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('flower','bear','star')),
  quantity  INTEGER DEFAULT 1
);

-- 11. 礼物赠送记录
CREATE TABLE IF NOT EXISTS gift_transfers (
  id         BIGSERIAL PRIMARY KEY,
  from_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 积分流水
CREATE TABLE IF NOT EXISTS points_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 行级安全策略
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- likes
DROP POLICY IF EXISTS "likes_select" ON likes;
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes_insert" ON likes;
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = liker_id);
DROP POLICY IF EXISTS "likes_delete" ON likes;
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = liker_id);

-- matches
DROP POLICY IF EXISTS "matches_select" ON matches;
CREATE POLICY "matches_select" ON matches FOR SELECT
  USING (auth.uid() IN (user_a, user_b));
DROP POLICY IF EXISTS "matches_insert" ON matches;
CREATE POLICY "matches_insert" ON matches FOR INSERT
  WITH CHECK (auth.uid() IN (user_a, user_b));

-- messages
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- posts
DROP POLICY IF EXISTS "posts_select" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts_insert" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = author_id);

-- comments
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = author_id);

-- post_likes
DROP POLICY IF EXISTS "post_likes_select" ON post_likes;
CREATE POLICY "post_likes_select" ON post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "post_likes_insert" ON post_likes;
CREATE POLICY "post_likes_insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;
CREATE POLICY "post_likes_delete" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- questions
DROP POLICY IF EXISTS "questions_select" ON questions;
CREATE POLICY "questions_select" ON questions FOR SELECT
  USING (answer_type = 'public' OR to_user_id = auth.uid());
DROP POLICY IF EXISTS "questions_insert" ON questions;
CREATE POLICY "questions_insert" ON questions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "questions_update" ON questions;
CREATE POLICY "questions_update" ON questions FOR UPDATE
  USING (to_user_id = auth.uid());

-- reports
DROP POLICY IF EXISTS "reports_select" ON reports;
CREATE POLICY "reports_select" ON reports FOR SELECT
  USING (reporter_id = auth.uid() OR target_id = auth.uid());
DROP POLICY IF EXISTS "reports_insert" ON reports;
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- gift_inventory
DROP POLICY IF EXISTS "gift_inventory_select" ON gift_inventory;
CREATE POLICY "gift_inventory_select" ON gift_inventory FOR SELECT
  USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "gift_inventory_insert" ON gift_inventory;
CREATE POLICY "gift_inventory_insert" ON gift_inventory FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "gift_inventory_update" ON gift_inventory;
CREATE POLICY "gift_inventory_update" ON gift_inventory FOR UPDATE
  USING (owner_id = auth.uid());

-- gift_transfers
DROP POLICY IF EXISTS "gift_transfers_select" ON gift_transfers;
CREATE POLICY "gift_transfers_select" ON gift_transfers FOR SELECT
  USING (auth.uid() IN (from_id, to_id));
DROP POLICY IF EXISTS "gift_transfers_insert" ON gift_transfers;
CREATE POLICY "gift_transfers_insert" ON gift_transfers FOR INSERT
  WITH CHECK (auth.uid() = from_id);

-- points_log
DROP POLICY IF EXISTS "points_log_select" ON points_log;
CREATE POLICY "points_log_select" ON points_log FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "points_log_insert" ON points_log;
CREATE POLICY "points_log_insert" ON points_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 辅助函数
-- ============================================================

-- 注册时自动创建 profile 的触发器
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', 'user_' || substring(NEW.id::text, 1, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 检查双向匹配
CREATE OR REPLACE FUNCTION check_match(liker UUID, liked UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM likes WHERE liker_id = liked AND liked_id = liker
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 获取匹配度
CREATE OR REPLACE FUNCTION get_match_score(uid_a UUID, uid_b UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  pa profiles%ROWTYPE;
  pb profiles%ROWTYPE;
BEGIN
  SELECT * INTO pa FROM profiles WHERE id = uid_a;
  SELECT * INTO pb FROM profiles WHERE id = uid_b;

  IF pa.school = pb.school THEN score := score + 20; END IF;
  IF pa.location = pb.location THEN score := score + 15; END IF;
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
