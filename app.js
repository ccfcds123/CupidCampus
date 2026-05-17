// ==================== SUPABASE INIT ====================
const SUPABASE_URL = 'https://mzbrrofgxndvvlfdjmvr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YnJyb2ZneG5kdnZsZmRqbXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjI0ODIsImV4cCI6MjA5NDMzODQ4Mn0.4jbrhyIXu2hIy0BPEf5rF17O55awCx547GLZRxYIpcU';

let sb = null;

// 初始化 Supabase 客户端（SDK 加载完成后调用）
function initSupabase() {
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client ready');
    // 检查是否有已登录会话
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentSession = session;
        getCurrentProfile().then(profile => {
          if (profile) enterApp();
        });
      }
    }).catch(() => {});
  }
}

// 如果 SDK 已经加载（同步情况），立即初始化
if (window.supabase) initSupabase();

// ==================== MBTI & CONSTANTS ====================

const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
];

const AVATAR_OPTIONS = ['🌸','🌟','🎸','🍰','🏀','📚','🎬','💻','🐱','🐶','🦊','🐰','🌈','🍀','🎨','🎵'];

const HOBBY_CATEGORIES = [
  { name: '🏃 体育运动', key: 'sports', tags: ['篮球','足球','跑步','游泳','健身','瑜伽','羽毛球','乒乓球','网球'] },
  { name: '🎨 文艺创作', key: 'arts', tags: ['绘画','摄影','写作','音乐','舞蹈','书法','设计','手工'] },
  { name: '🎮 游戏娱乐', key: 'gaming', tags: ['王者荣耀','原神','LOL','和平精英','桌游','剧本杀','Switch','二次元'] },
  { name: '📚 学习成长', key: 'study', tags: ['阅读','编程','英语','考研','考证','科研','辩论'] },
  { name: '🎬 影视音乐', key: 'media', tags: ['电影','动漫','K-pop','摇滚','爵士','古典音乐','追剧','脱口秀'] },
  { name: '🌍 户外旅行', key: 'travel', tags: ['徒步','露营','骑行','自驾','登山','滑雪','Citywalk'] },
  { name: '🍜 美食生活', key: 'food', tags: ['烹饪','烘焙','咖啡','探店','养宠物','园艺','穿搭'] }
];

const ALL_HOBBIES = HOBBY_CATEGORIES.reduce((arr, cat) => arr.concat(cat.tags), []);

const MBTI_COMPAT_PAIRS = new Set([
  'ENFP_INTJ','INTJ_ENFP','INFP_ENFJ','ENFJ_INFP','ENTP_INFJ','INFJ_ENTP','ENTJ_INTP','INTP_ENTJ',
  'ESTJ_ISFP','ISFP_ESTJ','ESFJ_ISTP','ISTP_ESFJ','ENFP_INFJ','INFJ_ENFP','ENTP_INTJ','INTJ_ENTP',
  'ENFJ_INFP','INFP_ENFJ','ENTJ_INTP','INTP_ENTJ','ESTP_ISFJ','ISFJ_ESTP','ESFP_ISTJ','ISTJ_ESFP'
]);

const GIFT_SHOP = [
  { id: 'flower', name: '小花', icon: '🌸', price: 15 },
  { id: 'bear', name: '小熊', icon: '🧸', price: 30 },
  { id: 'star', name: '星星', icon: '⭐', price: 50 }
];

const AUTO_REPLIES = [ /* (不再需要，真人聊天) */ ];

// ==================== STATE ====================

let currentUser = null;       // profiles 表的数据
let currentSession = null;    // Supabase auth session
let selectedGender = null;
let selectedAvatar = null;
let selectedMbti = null;
let currentPhotoUrl = null;
let currentCardIndex = 0;
let availableUsers = [];
let chatPartnerId = null;
let autoReplyTimer = null;
let reportTargetId = null;
let reportReason = null;
let giftTargetId = null;
let askTargetId = null;
let answerTargetQId = null;
let postImages = [];

// ==================== AUTH ====================

function requireClient() {
  if (!sb) { showToast('正在连接服务器，请稍后再试...'); return false; }
  return true;
}

async function signUp(email, password, profileData) {
  if (!requireClient()) return null;
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { nickname: profileData.nickname } }
    });
    if (error) { console.error('signUp error:', error); showToast('注册失败: ' + (error.message || error.msg || JSON.stringify(error))); return null; }
    if (!data.user) { showToast('请检查邮箱确认链接（或关闭邮箱验证）'); return null; }

    if (data.session) {
      const { error: updateErr } = await sb.from('profiles').update(profileData).eq('id', data.user.id);
      if (updateErr) console.error('profile update error:', updateErr);
    } else {
      console.log('signUp: no session, saving profile data to localStorage');
      localStorage.setItem('pendingProfile', JSON.stringify(profileData));
    }
    return data;
  } catch (e) {
    console.error('signUp exception:', e);
    showToast('注册失败: ' + (e.message || '网络错误'));
    return null;
  }
}

async function signIn(email, password) {
  if (!requireClient()) return null;
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { console.error('signIn error:', error); showToast('登录失败: ' + (error.message || error.msg || JSON.stringify(error))); return null; }
    return data;
  } catch (e) {
    console.error('signIn exception:', e);
    showToast('登录失败: ' + (e.message || '网络错误'));
    return null;
  }
}

async function signOut() {
  if (!requireClient()) return;
  try { await sb.auth.signOut(); } catch (e) { console.error('signOut error:', e); }
  currentUser = null;
  currentSession = null;
}

async function getCurrentProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  currentSession = session;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  currentUser = data;
  return data;
}

// ==================== DATA HELPERS ====================

async function fetchAvailableUsers() {
  if (!currentUser) { console.warn('fetchAvailableUsers: currentUser is null'); return []; }
  const { data: swiped } = await sb.from('likes').select('liked_id').eq('liker_id', currentUser.id);
  const swipedIds = (swiped || []).map(l => l.liked_id);
  swipedIds.push(currentUser.id); // exclude self

  const { data, error } = await sb.from('profiles').select('*');
  console.log('fetchAvailableUsers: total profiles fetched:', (data || []).length, 'error:', error, 'currentUser.id:', currentUser.id);
  const filtered = (data || []).filter(u => u.id !== currentUser.id && !swipedIds.includes(u.id));
  console.log('fetchAvailableUsers: after filter:', filtered.length, 'users:', filtered.map(u => u.nickname + '(' + u.gender + ')'));
  return filtered;
}

async function likeUserDB(targetId) {
  if (!currentUser) return;
  const { error } = await sb.from('likes').insert({ liker_id: currentUser.id, liked_id: targetId });
  if (error && error.code !== '23505') { showToast('操作失败'); return false; } // 23505 = unique violation (already liked)

  // Check mutual match
  const { data: mutual } = await sb.rpc('check_match', { liker: currentUser.id, liked: targetId });
  if (mutual) {
    await sb.from('matches').insert({ user_a: currentUser.id, user_b: targetId });
    return true; // match!
  }
  return false;
}

async function getMyLikes() {
  if (!currentUser) return [];
  const { data } = await sb.from('likes').select('liked_id, profiles!liked_id(*)').eq('liker_id', currentUser.id);
  return (data || []).map(d => d.profiles).filter(Boolean);
}

async function getLikesMe() {
  if (!currentUser) return [];
  const { data } = await sb.from('likes').select('liker_id, profiles!liker_id(*)').eq('liked_id', currentUser.id);
  return (data || []).map(d => d.profiles).filter(Boolean);
}

async function getMatches() {
  if (!currentUser) return [];
  const { data } = await sb.from('matches').select('*').or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`);
  return data || [];
}

// Chat
async function getMessages(partnerId) {
  if (!currentUser) return [];
  const { data } = await sb.from('messages').select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });
  return data || [];
}

async function sendMessageDB(partnerId, text, giftType = null) {
  if (!currentUser) return;
  await sb.from('messages').insert({
    sender_id: currentUser.id, receiver_id: partnerId, text, gift_type: giftType
  });
}

function subscribeToMessages(partnerId, onNewMessage) {
  return sb.channel('chat-' + [currentUser.id, partnerId].sort().join('-'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `sender_id=eq.${partnerId},receiver_id=eq.${currentUser.id}` },
      (payload) => { onNewMessage(payload.new); })
    .subscribe();
}

// Posts
async function getPosts() {
  const { data } = await sb.from('posts').select('*, profiles!author_id(*)').order('created_at', { ascending: false });
  return data || [];
}

async function createPost(text, images) {
  if (!currentUser) return;
  await sb.from('posts').insert({ author_id: currentUser.id, text, images });
}

async function togglePostLike(postId) {
  if (!currentUser) return;
  const { data: existing } = await sb.from('post_likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id).single();
  if (existing) {
    await sb.from('post_likes').delete().eq('id', existing.id);
  } else {
    await sb.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
  }
}

async function getComments(postId) {
  const { data } = await sb.from('comments').select('*, profiles!author_id(nickname)').eq('post_id', postId).order('created_at', { ascending: true });
  return data || [];
}

async function addCommentDB(postId, text) {
  if (!currentUser) return;
  await sb.from('comments').insert({ post_id: postId, author_id: currentUser.id, text });
}

// Questions
async function getMyQuestions() {
  if (!currentUser) return [];
  const { data } = await sb.from('questions').select('*').eq('to_user_id', currentUser.id).order('created_at', { ascending: false });
  return data || [];
}

async function askQuestionDB(targetId, question) {
  await sb.from('questions').insert({ to_user_id: targetId, question, from_name: '匿名同学' });
}

async function answerQuestionDB(qId, answer, answerType) {
  await sb.from('questions').update({ answer, answer_type: answerType, answer_time: new Date().toISOString() }).eq('id', qId);
}

// Reports
async function submitReportDB(targetId, reason, reasonLabel, desc) {
  if (!currentUser) return;
  await sb.from('reports').insert({ target_id: targetId, reporter_id: currentUser.id, reason, reason_label: reasonLabel, description: desc || '无' });
}

// Gifts & Points
async function buyGiftDB(giftId, price) {
  if (!currentUser || (currentUser.points || 0) < price) return false;
  const pts = currentUser.points - price;
  await sb.from('profiles').update({ points: pts }).eq('id', currentUser.id);
  const inv = currentUser.inventory || {};
  inv[giftId] = (inv[giftId] || 0) + 1;
  await sb.from('profiles').update({ inventory: inv }).eq('id', currentUser.id);
  await sb.from('points_log').insert({ user_id: currentUser.id, amount: -price, reason: '兑换' + giftId });
  currentUser.points = pts;
  currentUser.inventory = inv;
  return true;
}

async function sendGiftDB(targetId, giftId) {
  if (!currentUser) return;
  const inv = currentUser.inventory || {};
  if (!inv[giftId] || inv[giftId] <= 0) return false;
  inv[giftId]--;
  if (inv[giftId] <= 0) delete inv[giftId];
  await sb.from('profiles').update({ inventory: inv }).eq('id', currentUser.id);
  await sb.from('gift_transfers').insert({ from_id: currentUser.id, to_id: targetId, gift_type: giftId });
  currentUser.inventory = inv;
  return true;
}

async function doRechargeDB(amount) {
  if (!currentUser || amount <= 0) return;
  const pts = amount * 10;
  await sb.from('profiles').update({ points: (currentUser.points || 0) + pts }).eq('id', currentUser.id);
  await sb.from('points_log').insert({ user_id: currentUser.id, amount: pts, reason: '充值' + amount + '元' });
  currentUser.points = (currentUser.points || 0) + pts;
}

// ==================== UI INIT ====================

function init() {
  console.log('CupidCampus init() starting...');
  // Avatar picker
  const picker = document.getElementById('avatarPicker');
  if (picker) {
    AVATAR_OPTIONS.forEach(emoji => {
      const el = document.createElement('div');
      el.className = 'emoji-option';
      el.textContent = emoji;
      el.onclick = () => selectAvatar(emoji, el);
      picker.appendChild(el);
    });
  }

  // MBTI picker
  const mbtiPicker = document.getElementById('regMbtiPicker');
  if (mbtiPicker) {
    MBTI_TYPES.forEach(type => {
      const el = document.createElement('div');
      el.className = 'mbti-option';
      el.textContent = type;
      el.onclick = () => selectMbti(type, el);
      mbtiPicker.appendChild(el);
    });
  }

  // Multi-select prefs
  initMultiSelect('regPrefGrade', ['大一','大二','大三','大四','研一','研二'], []);
  initMultiSelect('regPrefLocation', ['北京','上海','广州','深圳','杭州','南京','武汉','成都','西安','重庆','其他'], []);
  initMultiSelect('regPrefMbti', MBTI_TYPES, []);
  buildHobbyPickers('regHobbiesContainer', []);
  console.log('CupidCampus UI ready');
}


// ==================== REGISTER / LOGIN ====================

async function handleRegister() {
  const email = document.getElementById('regEmail')?.value?.trim();
  const password = document.getElementById('regPassword')?.value?.trim();
  const nickname = document.getElementById('regNickname').value.trim();
  const grade = document.getElementById('regGrade').value;
  const school = document.getElementById('regSchool').value.trim();
  const major = document.getElementById('regMajor').value.trim();
  const location = document.getElementById('regLocation').value;
  const bio = document.getElementById('regBio').value.trim() || '这个人很懒，什么都没写...';
  const prefGender = document.getElementById('regPrefGender').value;
  const prefGrades = getMultiSelectValues('regPrefGrade');
  const prefLocations = getMultiSelectValues('regPrefLocation');
  const prefMbtis = getMultiSelectValues('regPrefMbti');
  const hobbies = getSelectedHobbies('regHobbiesContainer');

  if (!email) return showToast('请输入邮箱');
  if (!password) return showToast('请输入密码');
  if (!nickname) return showToast('请输入昵称');
  if (!selectedGender) return showToast('请选择性别');
  if (!grade) return showToast('请选择年级');
  if (!selectedAvatar) return showToast('请选择头像');
  if (!selectedMbti) return showToast('请选择 MBTI');

  const profileData = {
    nickname, gender: selectedGender, grade,
    school: school || '未填写', major: major || '未填写',
    location: location || '未填写', mbti: selectedMbti,
    bio, avatar: selectedAvatar,
    photo_url: currentPhotoUrl || null,
    hobbies, match_pref: { gender: prefGender, grades: prefGrades, locations: prefLocations, mbtis: prefMbtis }
  };

  const result = await signUp(email, password, profileData);
  if (result) {
    if (result.session) {
      await getCurrentProfile();
      enterApp();
    } else {
      showToast('注册成功！请前往邮箱点击确认链接完成验证');
      document.getElementById('regForm').style.display = 'none';
      document.getElementById('regForm').insertAdjacentHTML('afterend',
        '<div id="verifyNotice" style="text-align:center;padding:30px;color:#666;"><h3>📧 验证邮件已发送</h3><p>请检查邮箱并点击确认链接</p><p style="font-size:13px;margin-top:10px;">验证后刷新本页面即可自动登录</p></div>');
    }
  }
}

async function handleQuickLogin() {
  const email = document.getElementById('regEmail')?.value?.trim();
  const password = document.getElementById('regPassword')?.value?.trim();
  if (!email || !password) return showToast('请输入邮箱和密码');
  const result = await signIn(email, password);
  if (result) {
    await getCurrentProfile();
    if (currentUser) enterApp();
  }
}

// ==================== APP ENTRY ====================

async function enterApp() {
  if (!currentUser) { console.warn('enterApp: currentUser is null, aborting'); return; }
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('loginPage').style.display = 'none';
  hideAllPages();
  document.getElementById('mainPage').classList.add('active');
  document.getElementById('mainPage').style.display = 'flex';
  document.getElementById('mainPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnMatch').classList.add('active');

  // 补写邮箱验证模式下未写入的 profile 数据
  const pending = localStorage.getItem('pendingProfile');
  if (pending && currentUser) {
    try {
      const profileData = JSON.parse(pending);
      const { error: updateErr } = await sb.from('profiles').update(profileData).eq('id', currentUser.id);
      if (updateErr) {
        console.error('pending profile update error:', updateErr);
      } else {
        localStorage.removeItem('pendingProfile');
        await getCurrentProfile(); // 刷新本地 currentUser
      }
    } catch (e) { console.error('pending profile parse error:', e); }
  }

  updatePointsDisplay();
  updateVipDisplay();
  checkDailyLogin();
  await refreshAvailableUsers();
  switchMainTab('match');
  renderCard();
  updateLikeCounter();
}

async function refreshAvailableUsers() {
  availableUsers = await fetchAvailableUsers();
  if (currentUser) {
    availableUsers.sort((a, b) => calcMatchScore(currentUser, b) - calcMatchScore(currentUser, a));
  }
  currentCardIndex = 0;
}

async function handleLogout() {
  if (confirm('确定要退出吗？')) {
    await signOut();
    hideAllPages();
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPage').style.flexDirection = 'column';
  }
}

function hideAllPages() {
  ['mainPage','profilePage','chatPage','shopPage','memberPage','circlePage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); el.style.display = 'none'; }
  });
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('headerProfileBtn').style.display = 'none';
  document.getElementById('pointsBadge').style.display = 'none';
  document.getElementById('vipBadge').style.display = 'none';
  ['matchModal','reportModal','giftModal','askModal','answerModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ==================== MATCH SCORE ====================

function calcMatchScore(userA, userB) {
  let score = 0;
  if (userA.school && userB.school && userA.school === userB.school) score += 20;
  if (userA.location && userB.location && userA.location === userB.location) score += 15;
  const grades = ['大一','大二','大三','大四','研一','研二'];
  const idxA = grades.indexOf(userA.grade), idxB = grades.indexOf(userB.grade);
  if (idxA >= 0 && idxB >= 0 && Math.abs(idxA - idxB) <= 1) score += 10;
  const hobbiesA = userA.hobbies || [], hobbiesB = userB.hobbies || [];
  if (hobbiesA.length > 0 && hobbiesB.length > 0) {
    const shared = hobbiesA.filter(h => hobbiesB.includes(h));
    score += Math.round((shared.length / Math.max(hobbiesA.length, hobbiesB.length)) * 25);
  }
  if (userA.mbti && userB.mbti && MBTI_COMPAT_PAIRS.has(userA.mbti + '_' + userB.mbti)) score += 15;
  const pref = userA.match_pref || {};
  if (!pref.gender || pref.gender === '不限' || pref.gender === userB.gender) score += 15;
  return Math.min(score, 100);
}

// ==================== CARD LOGIC ====================

function renderCard() {
  const stack = document.getElementById('cardStack');
  const counter = document.getElementById('matchCounter');
  if (currentCardIndex >= availableUsers.length) {
    stack.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><h3>已经看完所有人啦</h3><p style="margin-bottom:14px;">去看看有没有配对成功的吧~</p><button class="btn btn-primary" onclick="resetSwipes()" style="max-width:200px;margin:0 auto;">🔄 重新浏览</button></div>`;
    counter.textContent = '';
    return;
  }
  const user = availableUsers[currentCardIndex];
  const remaining = availableUsers.length - currentCardIndex;
  const score = currentUser ? calcMatchScore(currentUser, user) : 0;
  const likeInfo = isVipActive() ? '👑 无限喜欢' : `今日剩余 ${getDailyLikesRemaining()} 次`;

  stack.innerHTML = `
    <div class="match-card" id="currentCard">
      <div class="card-avatar">${user.photo_url ? `<img src="${user.photo_url}" alt="">` : (user.avatar || '🌸')}</div>
      <div class="card-info">
        <div class="card-name-row">
          <span class="card-name">${escapeHtml(user.nickname)}</span>
          <span class="card-gender-tag ${user.gender === '男' ? 'male' : 'female'}">${user.gender || ''}</span>
          <span class="card-grade">${escapeHtml(user.grade || '')}</span>
          <span class="match-score-badge">${score}% 匹配</span>
        </div>
        <div class="card-meta-row">
          <span class="card-meta-tag">🏫 ${escapeHtml(user.school || '')}</span>
          <span class="card-meta-tag">📖 ${escapeHtml(user.major || '')}</span>
          <span class="card-meta-tag">📍 ${escapeHtml(user.location || '')}</span>
          <span class="card-meta-tag mbti">🧠 ${escapeHtml(user.mbti || '')}</span>
        </div>
        ${(user.hobbies || []).length > 0 ? `<div class="card-meta-row">${user.hobbies.slice(0,5).map(h => `<span class="card-meta-tag">${escapeHtml(h)}</span>`).join('')}</div>` : ''}
        <p class="card-bio">${escapeHtml(user.bio || '')}</p>
        <button class="card-report-btn" onclick="openAskModal('${user.id}');event.stopPropagation();" style="margin-right:8px;">💬 匿名提问</button>
        <button class="card-report-btn" onclick="openReportModal('${user.id}');event.stopPropagation();">🚩 举报</button>
      </div>
      <div class="card-actions">
        <button class="action-btn btn-skip" onclick="skipUser()">✖️</button>
        <button class="action-btn btn-like" onclick="likeUser('${user.id}')">❤️</button>
      </div>
    </div>`;
  counter.textContent = `还剩 ${remaining} 人 · ${likeInfo}`;
}

function skipUser() {
  if (currentCardIndex >= availableUsers.length) return;
  currentCardIndex++;
  // Skips not persisted (unlike likes), just advance
  renderCard();
}

async function likeUser(userId) {
  if (currentCardIndex >= availableUsers.length) return;
  const user = availableUsers[currentCardIndex];
  if (!isVipActive() && getDailyLikesRemaining() <= 0) {
    return showToast('今日喜欢次数已用完（10次）💔');
  }
  if (!isVipActive()) useDailyLike();

  const matched = await likeUserDB(userId);
  currentCardIndex++;

  if (matched) {
    showMatchModal(user);
    renderCard();
  } else {
    showToast(`已喜欢 ${user.nickname} 💌`);
    renderCard();
  }
  updateLikeCounter();
}

function showMatchModal(matchedUser) {
  chatPartnerId = matchedUser.id;
  document.getElementById('modalMyAvatar').innerHTML = renderAvatarHtml(currentUser);
  document.getElementById('modalMyName').textContent = currentUser.nickname;
  document.getElementById('modalMatchAvatar').innerHTML = renderAvatarHtml(matchedUser);
  document.getElementById('modalMatchName').textContent = matchedUser.nickname;
  document.getElementById('modalContactInfo').innerHTML = `
    🏫 ${matchedUser.school || ''} · ${matchedUser.major || ''}<br>
    🧠 MBTI：${matchedUser.mbti || ''}<br>
    💬 可以开始聊天啦~
  `;
  document.getElementById('modalBtnArea').innerHTML = `
    <button class="btn btn-outline" onclick="openChatFromModal()" style="flex:1;">💬 开始聊天</button>
    <button class="btn btn-primary" onclick="closeMatchModal()" style="flex:1;">🎉 太棒了！</button>
  `;
  document.getElementById('matchModal').style.display = 'flex';
}

function closeMatchModal() { document.getElementById('matchModal').style.display = 'none'; }

async function resetSwipes() {
  currentCardIndex = 0;
  await refreshAvailableUsers();
  renderCard();
  showToast('已刷新 🔄');
}

// ==================== MY PAGE ====================

let currentSubTab = 'liked';

function switchMainTab(tab) {
  // 隐藏所有独立页面，只保留 mainPage
  ['profilePage','chatPage','shopPage','memberPage','circlePage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); el.style.display = 'none'; }
  });

  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.querySelectorAll('#mainPage .nav-tabs .nav-tab').forEach(t => t.classList.remove('active'));
  const ms = document.getElementById('matchSection'), mp = document.getElementById('myPageSection');
  document.getElementById('mainPage').classList.add('active');
  document.getElementById('mainPage').style.display = 'flex';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';

  if (tab === 'match') {
    document.getElementById('tabMatch').classList.add('active');
    document.getElementById('bnMatch').classList.add('active');
    ms.style.display = 'flex'; mp.style.display = 'none';
    renderCard();
  } else {
    document.getElementById('tabMyPage').classList.add('active');
    document.getElementById('bnMyPage').classList.add('active');
    ms.style.display = 'none'; mp.style.display = 'flex';
    switchSubTab(currentSubTab);
  }
}

async function switchSubTab(tab) {
  currentSubTab = tab;
  ['subTabLike','subTabLikedMe','subTabMatched'].forEach(id => document.getElementById(id).classList.remove('active'));
  if (tab === 'liked') {
    document.getElementById('subTabLike').classList.add('active');
    const users = await getMyLikes();
    renderSubTabUsers(users, 'liked');
  } else if (tab === 'likedMe') {
    document.getElementById('subTabLikedMe').classList.add('active');
    if (!isVipActive()) {
      document.getElementById('subTabContent').innerHTML = `
        <div class="locked-overlay"><div class="locked-content"></div>
        <div class="locked-message"><div class="lock-icon">🔒</div><div class="lock-text">VIP 专属功能</div><div class="lock-sub">开通VIP查看谁喜欢了你</div>
        <button class="btn btn-primary btn-sm" onclick="goToMember()" style="background:linear-gradient(135deg,#FFD700,#FFA000);color:#3E2723;">👑 开通VIP</button></div></div>`;
      return;
    }
    const users = await getLikesMe();
    renderSubTabUsers(users, 'likedMe');
  } else if (tab === 'matched') {
    document.getElementById('subTabMatched').classList.add('active');
    const matches = await getMatches();
    const matchIds = matches.map(m => m.user_a === currentUser.id ? m.user_b : m.user_a);
    const { data: profiles } = await sb.from('profiles').select('*').in('id', matchIds);
    renderSubTabUsers(profiles || [], 'matched');
  }
}

function renderSubTabUsers(users, type) {
  const c = document.getElementById('subTabContent');
  if (users.length === 0) {
    const icons = { liked: '💔', likedMe: '🥺', matched: '💝' };
    const texts = { liked: '还没有喜欢的人', likedMe: '还没有人喜欢你', matched: '还没有配对成功' };
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons[type]}</div><h3>${texts[type]}</h3></div>`;
    return;
  }
  const matchSet = new Set();
  c.innerHTML = `<div class="user-list">${users.map(u => renderUserItem(u, type === 'matched')).join('')}</div>`;
}

function renderUserItem(user, isMatch) {
  const score = currentUser ? calcMatchScore(currentUser, user) : 0;
  return `
    <div class="user-item" ${isMatch ? `onclick="showMatchedContact('${user.id}')" style="cursor:pointer;"` : ''}>
      <div class="user-emoji">${renderAvatarHtml(user)}</div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(user.nickname)} · ${escapeHtml(user.grade || '')} <span class="match-score-badge" style="font-size:10px;padding:2px 8px;">${score}%</span></div>
        <div class="user-meta">🧠 ${escapeHtml(user.mbti||'')} · 🏫 ${escapeHtml(user.school||'')}</div>
        <div class="user-bio">${escapeHtml(user.bio||'')}</div>
      </div>
      ${isMatch ? '<span class="matched-badge">💑 已配对</span>' : ''}
      <button class="list-report-btn" onclick="openAskModal('${user.id}');event.stopPropagation();">💬</button>
      ${isMatch ? `<button class="list-report-btn" onclick="openGiftModal('${user.id}','${escapeHtml(user.nickname)}');event.stopPropagation();">🎁</button>` : ''}
      <button class="list-report-btn" onclick="openReportModal('${user.id}');event.stopPropagation();">🚩</button>
    </div>`;
}

function showMatchedContact(userId) { /* Reuse match modal for contact info */
  const user = availableUsers.find(u => u.id === userId);
  if (!user) return;
  chatPartnerId = userId;
  showMatchModal(user);
}

function openChatFromModal() {
  document.getElementById('matchModal').style.display = 'none';
  if (chatPartnerId) openChat(chatPartnerId);
}

// ==================== CHAT ====================

let chatChannel = null;

async function openChat(userId) {
  chatPartnerId = userId;
  const { data: partner } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (!partner) return;

  hideAllPages();
  document.getElementById('chatPage').classList.add('active');
  document.getElementById('chatPage').style.display = 'flex';
  document.getElementById('chatPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('headerProfileBtn').style.display = 'none';
  document.getElementById('pointsBadge').style.display = 'flex';

  document.getElementById('chatPartnerAvatar').innerHTML = renderAvatarHtml(partner);
  document.getElementById('chatPartnerName').textContent = partner.nickname;

  await renderChatMessages();
  document.getElementById('chatInput').value = '';
  setTimeout(() => document.getElementById('chatInput').focus(), 200);

  // Subscribe to realtime messages
  if (chatChannel) sb.removeChannel(chatChannel);
  chatChannel = sb.channel('chat-' + [currentUser.id, userId].sort().join('-'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `sender_id=eq.${userId},receiver_id=eq.${currentUser.id}` },
      async () => { await renderChatMessages(); })
    .subscribe();
}

async function closeChat() {
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  chatPartnerId = null;
  document.getElementById('chatPage').classList.remove('active');
  document.getElementById('chatPage').style.display = 'none';
  document.getElementById('mainPage').classList.add('active');
  document.getElementById('mainPage').style.display = 'flex';
  document.getElementById('mainPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';
  switchMainTab('mypage');
}

async function sendMessage() {
  if (!chatPartnerId) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  await sendMessageDB(chatPartnerId, text);
  input.value = '';
  await renderChatMessages();
}

async function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  const messages = await getMessages(chatPartnerId);
  if (messages.length === 0) {
    container.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">💬</div>发送第一条消息，开始聊天吧~</div>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const isMine = m.sender_id === currentUser.id;
    const time = new Date(m.created_at).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });
    return `<div class="chat-msg ${isMine ? 'sent' : 'received'}"><div>${escapeHtml(m.text)}</div><div class="msg-time">${time}</div></div>`;
  }).join('');
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// ==================== CAMPUS CIRCLE ====================

function openCircle() {
  hideAllPages();
  document.getElementById('circlePage').classList.add('active');
  document.getElementById('circlePage').style.display = 'flex';
  document.getElementById('circlePage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnCircle').classList.add('active');
  updateVipDisplay();
  renderFeed();
}

async function publishPost() {
  const text = document.getElementById('postText').value.trim();
  if (!text && postImages.length === 0) return showToast('请输入内容或添加图片');
  await createPost(text, postImages);
  document.getElementById('postText').value = '';
  postImages = [];
  document.getElementById('postPreview').innerHTML = '';
  await renderFeed();
  showToast('发布成功！📝');
}

async function toggleLike(postId) {
  await togglePostLike(postId);
  await renderFeed();
}

async function addComment(postId) {
  const input = document.getElementById('cmtInput_' + postId);
  const text = (input ? input.value : '').trim();
  if (!text) return;
  await addCommentDB(postId, text);
  await renderFeed();
}

async function renderFeed() {
  const container = document.getElementById('feedContainer');
  const posts = await getPosts();
  document.getElementById('circlePostCount').textContent = (posts || []).length + ' 条动态';
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🌳</div><h3>还没有动态</h3><p>发布第一条校园圈动态吧~</p></div>';
    return;
  }
  container.innerHTML = posts.map(post => {
    const profile = post.profiles || {};
    const isLiked = false; // Simplified; would need to fetch user's likes
    const imgHtml = (post.images || []).length > 0
      ? `<div class="feed-post-images${post.images.length === 1 ? ' single' : ''}">${post.images.map(url => `<img src="${url}" alt="">`).join('')}</div>` : '';
    return `
      <div class="feed-post-card">
        <div class="feed-post-header">
          <div class="post-avatar">${profile.photo_url ? `<img src="${profile.photo_url}" alt="">` : (profile.avatar || '🌸')}</div>
          <div><div class="post-author">${escapeHtml(profile.nickname || '')}</div>
          <div class="post-time">${new Date(post.created_at).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
        </div>
        ${post.text ? `<div class="feed-post-text">${escapeHtml(post.text)}</div>` : ''}
        ${imgHtml}
        <div class="feed-post-actions">
          <button class="${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}')">🤍 0</button>
          <button onclick="document.getElementById('cmtInput_${post.id}').focus()">💬 0</button>
        </div>
        <div class="feed-comment-input">
          <input type="text" id="cmtInput_${post.id}" placeholder="写评论..." maxlength="150" onkeydown="if(event.key==='Enter')addComment('${post.id}')">
          <button onclick="addComment('${post.id}')">发送</button>
        </div>
      </div>`;
  }).join('');
}

function goToCircle() {
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnCircle').classList.add('active');
  openCircle();
}

// ==================== SHOP & GIFTS ====================

function openShop() {
  hideAllPages();
  document.getElementById('shopPage').classList.add('active');
  document.getElementById('shopPage').style.display = 'flex';
  document.getElementById('shopPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnShop').classList.add('active');
  renderShop();
}

function closeShop() {
  document.getElementById('shopPage').classList.remove('active');
  document.getElementById('shopPage').style.display = 'none';
  enterApp();
}

function renderShop() {
  const pts = currentUser ? (currentUser.points || 0) : 0;
  document.getElementById('shopPointsDisplay').textContent = pts;
  document.getElementById('shopGiftGrid').innerHTML = GIFT_SHOP.map(g => {
    const canBuy = pts >= g.price;
    return `<div class="shop-gift-card"><div class="gift-icon">${g.icon}</div><div class="gift-name">${g.name}</div><div class="gift-price">🪙 ${g.price}</div>
      <button class="btn btn-sm ${canBuy ? 'btn-primary' : 'btn-outline'}" onclick="buyGift('${g.id}')" ${canBuy ? '' : 'disabled'} style="margin-top:6px;width:100%;font-size:12px;padding:8px;">${canBuy ? '兑换' : '积分不足'}</button></div>`;
  }).join('');
  const inv = currentUser?.inventory || {};
  const items = GIFT_SHOP.filter(g => inv[g.id] > 0);
  document.getElementById('inventoryDisplay').innerHTML = items.length === 0
    ? '<span style="font-size:13px;color:var(--text-secondary);">还没有礼物，去兑换吧~</span>'
    : items.map(g => `<div class="inventory-item"><div class="inv-icon">${g.icon}</div><div class="inv-count">x${inv[g.id]}</div></div>`).join('');
}

async function buyGift(giftId) {
  const gift = GIFT_SHOP.find(g => g.id === giftId);
  if (!gift) return;
  const ok = await buyGiftDB(giftId, gift.price);
  if (!ok) return showToast('积分不足！');
  updatePointsDisplay();
  renderShop();
  showToast(`成功兑换 ${gift.icon} ${gift.name}！`);
}

function openGiftModal(userId, userName) {
  giftTargetId = userId;
  const inv = currentUser?.inventory || {};
  document.getElementById('giftTargetName').textContent = '送给：' + userName;
  document.getElementById('giftOptions').innerHTML = GIFT_SHOP.map(g => {
    const owned = inv[g.id] || 0;
    return `<div class="shop-gift-card" onclick="${owned > 0 ? `sendGift('${g.id}')` : ''}" style="cursor:${owned>0?'pointer':'default'};opacity:${owned>0?'1':'0.4'};">
      <div class="gift-icon">${g.icon}</div><div class="gift-name">${g.name}</div><div class="gift-owned">拥有 x${owned}</div></div>`;
  }).join('');
  document.getElementById('giftModal').style.display = 'flex';
}

function openGiftModalFromChat() {
  if (!chatPartnerId) return;
  const partner = availableUsers.find(u => u.id === chatPartnerId);
  if (partner) openGiftModal(chatPartnerId, partner.nickname);
}

async function sendGift(giftId) {
  if (!giftTargetId) return;
  const ok = await sendGiftDB(giftTargetId, giftId);
  if (!ok) return showToast('你没有这个礼物！');
  const gift = GIFT_SHOP.find(g => g.id === giftId);
  closeGiftModal();
  if (gift) {
    showToast(`${gift.icon} 已送出！`);
    if (chatPartnerId === giftTargetId) {
      await sendMessageDB(giftTargetId, `🎁 送出了 ${gift.icon} ${gift.name}`);
      if (document.getElementById('chatPage').classList.contains('active')) await renderChatMessages();
    }
  }
}

function closeGiftModal() { document.getElementById('giftModal').style.display = 'none'; giftTargetId = null; }

function goToShop() {
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnShop').classList.add('active');
  openShop();
}

// ==================== VIP & POINTS ====================

function isVipActive() {
  if (!currentUser) return false;
  if (!currentUser.is_vip) return false;
  if (currentUser.vip_expire && new Date(currentUser.vip_expire) < new Date()) {
    currentUser.is_vip = false;
    return false;
  }
  return true;
}

function updateVipDisplay() {
  const vip = isVipActive();
  document.getElementById('vipBadge').style.display = currentUser ? (vip ? 'inline-flex' : 'none') : 'none';
}

function updatePointsDisplay() {
  const pts = currentUser ? (currentUser.points || 0) : 0;
  const el = document.getElementById('pointsValue');
  if (el) el.textContent = pts;
  document.getElementById('pointsBadge').style.display = currentUser ? 'flex' : 'none';
}

function updateLikeCounter() {
  const counter = document.getElementById('matchCounter');
  if (!counter) return;
  const info = isVipActive() ? '👑 无限喜欢' : `今日剩余 ${getDailyLikesRemaining()} 次`;
  counter.textContent = counter.textContent.replace(/·.*/, '') + ' · ' + info;
}

function getDailyLikesRemaining() {
  if (isVipActive()) return Infinity;
  if (!currentUser) return 0;
  const today = new Date().toLocaleDateString('zh-CN');
  if (currentUser.daily_likes_date !== today) {
    currentUser.daily_likes_used = 0;
    currentUser.daily_likes_date = today;
  }
  return Math.max(0, 10 - (currentUser.daily_likes_used || 0));
}

function useDailyLike() {
  if (!currentUser) return false;
  const today = new Date().toLocaleDateString('zh-CN');
  if (currentUser.daily_likes_date !== today) { currentUser.daily_likes_used = 0; currentUser.daily_likes_date = today; }
  if ((currentUser.daily_likes_used || 0) >= 10) return false;
  currentUser.daily_likes_used = (currentUser.daily_likes_used || 0) + 1;
  return true;
}

function checkDailyLogin() {
  if (!currentUser) return;
  const today = new Date().toLocaleDateString('zh-CN');
  if (currentUser.last_login !== today) {
    currentUser.last_login = today;
    const bonus = isVipActive() ? 15 : 10;
    currentUser.points = (currentUser.points || 0) + bonus;
    sb.from('profiles').update({ points: currentUser.points, last_login: today }).eq('id', currentUser.id);
    sb.from('points_log').insert({ user_id: currentUser.id, amount: bonus, reason: isVipActive() ? 'VIP每日签到' : '每日登录奖励' });
    showToast(`${isVipActive() ? 'VIP每日签到' : '每日登录奖励'} +${bonus} 🪙`);
    updatePointsDisplay();
  }
}

async function buyVip() {
  if (!currentUser) return;
  currentUser.is_vip = true;
  currentUser.vip_expire = new Date(Date.now() + 30 * 86400000).toISOString();
  await sb.from('profiles').update({ is_vip: true, vip_expire: currentUser.vip_expire }).eq('id', currentUser.id);
  updateVipDisplay();
  updatePointsDisplay();
  showToast('👑 VIP 开通成功！');
}

async function doRecharge(amount) {
  if (!amount || amount <= 0) return showToast('请输入有效金额');
  await doRechargeDB(amount);
  updatePointsDisplay();
  if (document.getElementById('shopPage').classList.contains('active')) renderShop();
  showToast(`充值成功！+${amount * 10} 积分 💰`);
}

function goToMember() {
  ['bnMatch','bnMyPage','bnShop','bnVip','bnCircle'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('bnVip').classList.add('active');
  openMemberPage();
}

function openMemberPage() {
  hideAllPages();
  document.getElementById('memberPage').classList.add('active');
  document.getElementById('memberPage').style.display = 'flex';
  document.getElementById('memberPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  document.getElementById('pointsBadge').style.display = 'flex';
  updateVipDisplay();
}

function closeMemberPage() {
  document.getElementById('memberPage').classList.remove('active');
  document.getElementById('memberPage').style.display = 'none';
  enterApp();
}

// ==================== Q&A ====================

function openAskModal(userId) {
  askTargetId = userId;
  document.getElementById('askTargetName').textContent = '匿名提问';
  document.getElementById('askText').value = '';
  document.getElementById('askModal').style.display = 'flex';
}

function closeAskModal() { document.getElementById('askModal').style.display = 'none'; askTargetId = null; }

async function submitQuestion() {
  const text = document.getElementById('askText').value.trim();
  if (!text) return showToast('请输入问题');
  if (!askTargetId) return;
  await askQuestionDB(askTargetId, text);
  closeAskModal();
  showToast('匿名提问已发送 💌');
}

function openAnswerModal(qId) {
  answerTargetQId = qId;
  document.getElementById('answerModal').style.display = 'flex';
}

function closeAnswerModal() { document.getElementById('answerModal').style.display = 'none'; answerTargetQId = null; }

async function submitAnswer(type) {
  const text = document.getElementById('answerText').value.trim();
  if (!text) return showToast('请输入回答');
  if (!answerTargetQId) return;
  await answerQuestionDB(answerTargetQId, text, type);
  closeAnswerModal();
  showToast(type === 'public' ? '已公开回答 🌐' : '已私密回答 🔒');
  if (document.getElementById('profilePage').classList.contains('active')) await renderProfileQASection();
}

async function renderProfileQASection() {
  if (!currentUser) return;
  const questions = await getMyQuestions();
  let qaContainer = document.getElementById('profileQASection');
  if (!qaContainer) {
    const card = document.getElementById('profileEditCard');
    qaContainer = document.createElement('div');
    qaContainer.id = 'profileQASection';
    qaContainer.className = 'qa-section';
    if (card) card.after(qaContainer);
  }
  const pending = questions.filter(q => !q.answer && q.answer_type !== 'ignored');
  const answered = questions.filter(q => q.answer && q.answer_type !== 'ignored');
  let html = '<h4>💬 匿名提问箱</h4>';
  if (pending.length > 0) {
    html += `<div style="margin-bottom:12px;"><span style="font-size:12px;color:#FF9800;">📥 待回答 (${pending.length})</span></div>`;
    pending.forEach(q => {
      html += `<div class="qa-item"><div class="qa-question">${escapeHtml(q.question)} <span class="qa-from">— ${escapeHtml(q.from_name)}</span></div>
        <div class="qa-actions"><button class="qa-answer-btn" onclick="openAnswerModal('${q.id}')">✏️ 回答</button>
        <button class="qa-ignore-btn" onclick="ignoreQuestion('${q.id}')">🚫 忽略</button></div></div>`;
    });
  }
  if (answered.length > 0) {
    html += `<div style="margin-top:12px;"><span style="font-size:12px;color:var(--text-secondary);">✅ 已回答 (${answered.length})</span></div>`;
    answered.forEach(q => {
      html += `<div class="qa-item"><div class="qa-question">${escapeHtml(q.question)} <span class="qa-from">— ${escapeHtml(q.from_name)}</span></div>
        <div class="qa-answer">${escapeHtml(q.answer||'')} <span class="qa-badge ${q.answer_type}">${q.answer_type === 'public' ? '🌐 公开' : '🔒 私密'}</span></div></div>`;
    });
  }
  if (pending.length === 0 && answered.length === 0) {
    html += '<span style="font-size:13px;color:var(--text-secondary);">还没有收到提问~</span>';
  }
  qaContainer.innerHTML = html;
}

async function ignoreQuestion(qId) {
  await sb.from('questions').update({ answer_type: 'ignored' }).eq('id', qId);
  showToast('已忽略');
  if (document.getElementById('profilePage').classList.contains('active')) await renderProfileQASection();
}

// ==================== REPORT ====================

function openReportModal(userId) {
  reportTargetId = userId;
  reportReason = null;
  document.getElementById('reportTargetName').textContent = '举报用户';
  document.getElementById('reportDescription').value = '';
  document.querySelectorAll('#reportReasonGroup .report-reason-option').forEach(el => el.classList.remove('selected'));
  document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() { document.getElementById('reportModal').style.display = 'none'; reportTargetId = null; reportReason = null; }

function selectReportReason(reason, el) {
  reportReason = reason;
  document.querySelectorAll('#reportReasonGroup .report-reason-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

async function submitReport() {
  if (!reportReason) return showToast('请选择举报原因');
  if (!reportTargetId) return;
  const desc = document.getElementById('reportDescription').value.trim();
  const labels = { harassment: '骚扰信息', fake: '假照片/虚假资料', other: '其他原因' };
  await submitReportDB(reportTargetId, reportReason, labels[reportReason] || reportReason, desc);
  closeReportModal();
  showToast('举报已提交 ✅');
}

// ==================== PROFILE EDIT ====================

function openProfilePage() {
  document.getElementById('mainPage').style.display = 'none';
  document.getElementById('mainPage').classList.remove('active');
  document.getElementById('profilePage').classList.add('active');
  document.getElementById('profilePage').style.display = 'flex';
  document.getElementById('profilePage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('headerProfileBtn').style.display = 'none';
  currentPhotoUrl = currentUser?.photo_url || null;
  renderProfileEditForm();
  renderProfileQASection();
}

function closeProfilePage() {
  document.getElementById('profilePage').classList.remove('active');
  document.getElementById('profilePage').style.display = 'none';
  document.getElementById('mainPage').classList.add('active');
  document.getElementById('mainPage').style.display = 'flex';
  document.getElementById('mainPage').style.flexDirection = 'column';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('headerProfileBtn').style.display = 'flex';
  switchMainTab('match');
}

function renderProfileEditForm() {
  const card = document.getElementById('profileEditCard');
  const mbtiHtml = MBTI_TYPES.map(t => `<div class="mbti-option${currentUser?.mbti === t ? ' selected' : ''}" onclick="profileSelectMbti('${t}', this)">${t}</div>`).join('');
  const avatarHtml = AVATAR_OPTIONS.map(a => `<div class="emoji-option${currentUser?.avatar === a ? ' selected' : ''}" onclick="profileSelectAvatar('${a}', this)">${a}</div>`).join('');
  const pref = currentUser?.match_pref || {};

  card.innerHTML = `
    <div class="form-section-title">📝 基本信息</div>
    <div class="form-row">
      <div class="form-group"><label>昵称</label><input type="text" id="profNickname" value="${escapeHtml(currentUser?.nickname||'')}" maxlength="20"></div>
      <div class="form-group"><label>性别</label><div class="gender-toggle" id="profGenderToggle">
        <button data-gender="男" onclick="profileSelectGender('男', this)" class="${currentUser?.gender==='男'?'selected':''}">🙋 男</button>
        <button data-gender="女" onclick="profileSelectGender('女', this)" class="${currentUser?.gender==='女'?'selected':''}">🙋‍♀️ 女</button></div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>年级</label><select id="profGrade">${['大一','大二','大三','大四','研一','研二'].map(g => `<option value="${g}" ${currentUser?.grade===g?'selected':''}>${g}</option>`).join('')}</select></div>
      <div class="form-group"><label>学校</label><input type="text" id="profSchool" value="${escapeHtml(currentUser?.school||'')}" maxlength="30"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>专业</label><input type="text" id="profMajor" value="${escapeHtml(currentUser?.major||'')}" maxlength="30"></div>
      <div class="form-group"><label>城市</label><select id="profLocation">${['北京','上海','广州','深圳','杭州','南京','武汉','成都','西安','重庆','其他'].map(c => `<option value="${c}" ${currentUser?.location===c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>MBTI</label><div class="mbti-picker" id="profMbtiPicker">${mbtiHtml}</div><input type="hidden" id="profMbtiHidden" value="${currentUser?.mbti||''}"></div>
    <div class="form-group"><label>兴趣爱好</label><div id="profHobbiesContainer"></div></div>
    <div class="form-group"><label>自我介绍</label><textarea id="profBio" maxlength="100">${escapeHtml(currentUser?.bio||'')}</textarea></div>
    <div class="form-group"><label>上传照片</label><div class="photo-upload-area${currentUser?.photo_url?' has-photo':''}" id="profPhotoArea" onclick="document.getElementById('profPhotoInput').click()">
      <input type="file" id="profPhotoInput" accept="image/*" onchange="handlePhotoUpload(this,'profPhotoArea','profPhotoPreview','profPhotoRemove','profPhotoPlaceholder')" style="display:none;">
      <img class="photo-preview${currentUser?.photo_url?' visible':''}" id="profPhotoPreview" src="${currentUser?.photo_url||''}">
      <div class="photo-placeholder" id="profPhotoPlaceholder" style="${currentUser?.photo_url?'display:none':''}"><span class="upload-icon">📷</span>点击上传照片</div>
      <button class="photo-remove-btn" id="profPhotoRemove" onclick="removePhoto('profPhotoInput','profPhotoArea','profPhotoPreview','profPhotoPlaceholder','profPhotoRemove');event.stopPropagation();">✕</button></div></div>
    <div class="form-group"><label>默认头像</label><div class="avatar-picker" id="profAvatarPicker">${avatarHtml}</div><input type="hidden" id="profAvatarHidden" value="${currentUser?.avatar||''}"></div>
    <div class="form-section-title">🎯 匹配偏好（可多选）</div>
    <div class="form-row"><div class="form-group"><label>期望性别</label><select id="profPrefGender">${['不限','男','女'].map(g => `<option value="${g}" ${pref.gender===g?'selected':''}>${g==='不限'?'不限':g==='男'?'男生':'女生'}</option>`).join('')}</select></div>
    <div class="form-group"><label>期望年级</label><div class="multi-select-picker" id="profPrefGrade"></div></div></div>
    <div class="form-group"><label>期望城市</label><div class="multi-select-picker" id="profPrefLocation"></div></div>
    <div class="form-group"><label>期望 MBTI</label><div class="multi-select-picker" id="profPrefMbti"></div></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn btn-outline btn-sm" onclick="closeProfilePage()" style="flex:1;">取消</button>
      <button class="btn btn-primary btn-sm" onclick="saveProfile()" style="flex:1;">💾 保存</button></div>`;

  initMultiSelect('profPrefGrade', ['大一','大二','大三','大四','研一','研二'], pref.grades || []);
  initMultiSelect('profPrefLocation', ['北京','上海','广州','深圳','杭州','南京','武汉','成都','西安','重庆','其他'], pref.locations || []);
  initMultiSelect('profPrefMbti', MBTI_TYPES, pref.mbtis || []);
  buildHobbyPickers('profHobbiesContainer', currentUser?.hobbies || []);
}

function profileSelectGender(g, btn) {
  document.querySelectorAll('#profGenderToggle button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function profileSelectAvatar(emoji, el) {
  document.querySelectorAll('#profAvatarPicker .emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('profAvatarHidden').value = emoji;
}

function profileSelectMbti(type, el) {
  document.querySelectorAll('#profMbtiPicker .mbti-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('profMbtiHidden').value = type;
}

async function saveProfile() {
  const nickname = document.getElementById('profNickname').value.trim();
  if (!nickname) return showToast('请输入昵称');
  const genderBtn = document.querySelector('#profGenderToggle button.selected');
  const profileData = {
    nickname,
    gender: genderBtn?.dataset?.gender || currentUser?.gender,
    grade: document.getElementById('profGrade').value,
    school: document.getElementById('profSchool').value.trim() || '未填写',
    major: document.getElementById('profMajor').value.trim() || '未填写',
    location: document.getElementById('profLocation').value || '未填写',
    mbti: document.getElementById('profMbtiHidden').value,
    bio: document.getElementById('profBio').value.trim() || '这个人很懒，什么都没写...',
    avatar: document.getElementById('profAvatarHidden').value,
    photo_url: currentPhotoUrl || null,
    hobbies: getSelectedHobbies('profHobbiesContainer'),
    match_pref: {
      gender: document.getElementById('profPrefGender').value,
      grades: getMultiSelectValues('profPrefGrade'),
      locations: getMultiSelectValues('profPrefLocation'),
      mbtis: getMultiSelectValues('profPrefMbti')
    }
  };
  await sb.from('profiles').update(profileData).eq('id', currentUser.id);
  Object.assign(currentUser, profileData);
  updatePointsDisplay();
  showToast('个人资料已保存 ✅');
  closeProfilePage();
}

// ==================== HELPERS ====================

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderAvatarHtml(user) {
  if (user?.photo_url) return `<img src="${user.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  return user?.avatar || '🌸';
}

function selectGender(gender, btn) {
  selectedGender = gender;
  document.querySelectorAll('#genderToggle button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectAvatar(emoji, el) {
  selectedAvatar = emoji;
  document.querySelectorAll('#avatarPicker .emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectMbti(type, el) {
  selectedMbti = type;
  document.querySelectorAll('#regMbtiPicker .mbti-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function goToMatch() { switchMainTab('match'); }
function goToMyPage() { switchMainTab('mypage'); }

// ==================== PHOTO UPLOAD ====================

function handlePhotoUpload(input, areaId, previewId, removeBtnId, placeholderId) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    resizeImage(e.target.result, 400, 400, function(resized) {
      currentPhotoUrl = resized;
      document.getElementById(areaId).classList.add('has-photo');
      document.getElementById(previewId).src = resized;
      document.getElementById(previewId).classList.add('visible');
      if (placeholderId) { const ph = document.getElementById(placeholderId); if (ph) ph.style.display = 'none'; }
    });
  };
  reader.readAsDataURL(file);
}

function resizeImage(dataUrl, maxW, maxH, callback) {
  const img = new Image();
  img.onload = function() {
    let w = img.width, h = img.height;
    if (w > maxW) { h = h * (maxW / w); w = maxW; }
    if (h > maxH) { w = w * (maxH / h); h = maxH; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.src = dataUrl;
}

function removePhoto(inputId, areaId, previewId, placeholderId, removeBtnId) {
  currentPhotoUrl = null;
  document.getElementById(inputId).value = '';
  document.getElementById(areaId).classList.remove('has-photo');
  document.getElementById(previewId).src = '';
  document.getElementById(previewId).classList.remove('visible');
  if (placeholderId) document.getElementById(placeholderId).style.display = '';
}

function handlePostImages(input) {
  Array.from(input.files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      resizeImage(e.target.result, 600, 600, function(resized) {
        postImages.push(resized);
        renderPostPreview();
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderPostPreview() {
  document.getElementById('postPreview').innerHTML = postImages.map((url, i) =>
    `<div class="preview-img-wrap"><img src="${url}"><button class="preview-remove" onclick="removePostImage(${i})">✕</button></div>`).join('');
}

function removePostImage(idx) { postImages.splice(idx, 1); renderPostPreview(); }

// ==================== MULTI-SELECT & HOBBY HELPERS ====================

function initMultiSelect(containerId, options, selectedValues) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selSet = new Set(selectedValues || []);
  container.innerHTML = options.map(opt =>
    `<div class="tag-option${selSet.has(opt) ? ' selected' : ''}" onclick="this.classList.toggle('selected')">${opt}</div>`
  ).join('');
}

function getMultiSelectValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.tag-option.selected')).map(el => el.textContent);
}

function buildHobbyPickers(containerId, selectedHobbies) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selSet = new Set(selectedHobbies || []);
  container.innerHTML = HOBBY_CATEGORIES.map(cat => `
    <div class="hobby-category"><div class="hobby-cat-label">${cat.name}</div>
      <div class="multi-select-picker">${cat.tags.map(t =>
        `<div class="tag-option${selSet.has(t) ? ' selected' : ''}" onclick="this.classList.toggle('selected')">${t}</div>`
      ).join('')}</div></div>`).join('');
}

function getSelectedHobbies(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.tag-option.selected')).map(el => el.textContent);
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('click', function(e) {
  if (e.target.id === 'matchModal') closeMatchModal();
  if (e.target.id === 'reportModal') closeReportModal();
  if (e.target.id === 'giftModal') closeGiftModal();
  if (e.target.id === 'askModal') closeAskModal();
  if (e.target.id === 'answerModal') closeAnswerModal();
});

// ==================== BOOT ====================

init();
