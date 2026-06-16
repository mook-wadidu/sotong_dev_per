-- 소통(Sotong) — seed
-- 0001_core.sql 적용 후 로드 (config.toml [db.seed] sql_paths = ["./seed.sql"]).
--
-- ⚠️ 로컬/데모 전용. 운영 DB 에 절대 적용 금지.
--   아래 owner_token / staff_token 은 공개 repo 에 박힌 고정 평문이라 "비밀"이 아니다.
--   `supabase db reset` 의 [db.seed] 자동 로드는 로컬 한정으로만 사용하고,
--   운영 환경에는 이 파일을 시드하지 말 것(운영 토큰은 어드민 온보딩으로 강한 랜덤 발급/회전).
--   운영에 실수로 적용됐다면 즉시 owner_token/staff_token 을 회전해야 한다.
--
-- 정합 기준:
--   * 살롱(그룹)  ← src/lib/db/memory.ts DEMO_SALONS (slug·이름·메타 고정값 동일)
--   * 디자이너    ← src/lib/db/memory.ts DEMO_DESIGNERS (id·이름·staff_token 고정값 동일, 살롱당 2명)
--   * 카탈로그 id  ← src/lib/catalog/data.ts (서비스/카테고리/얼굴형/고민/모발이력/퀵리플라이/타임프리셋/제품)
-- 재실행 가능하도록 on conflict 로 upsert.

-- ─────────────────────────────────────────────────────────────────────────────
-- locales
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.locales (code, label, is_customer, sort_order) values
  ('ko', '한국어',   true, 1),
  ('ja', '日本語',   true, 2),
  ('en', 'English',  true, 3)
on conflict (code) do update
  set label = excluded.label, is_customer = excluded.is_customer, sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 살롱(그룹) 2곳 (memory.ts DEMO_SALONS 와 동일 — 그룹 메타만)
-- ─────────────────────────────────────────────────────────────────────────────
-- designer_ranks(직급) 양 살롱 동일: 원장/실장/디자이너. owner_token 은 memory.ts 와 동일 고정값.
insert into public.salons
  (slug, name, name_translations, locales,
   address, tel, business_hours, placement_label, entry_key_version,
   designer_ranks, owner_token)
values
  ('salon-demo', '소통 헤어 신사점',
   '{"ja":"ソトン ヘア 新沙店","en":"Sotong Hair Sinsa"}'::jsonb,
   array['ja','en','ko']::text[],
   '서울 강남구 신사동 가로수길 12', '02-1234-5678', '10:00–20:00 (월 휴무)',
   '입구 데스크 / 거울 앞', 1,
   '[{"id":"director","label":"원장"},{"id":"senior","label":"실장"},{"id":"designer","label":"디자이너"}]'::jsonb,
   'owner_sinsa_a1b2c3d4e5f6'),
  ('salon-hongdae', '소통 헤어 홍대점',
   '{"ja":"ソトン ヘア 弘大店","en":"Sotong Hair Hongdae"}'::jsonb,
   array['ja','en','ko']::text[],
   '서울 마포구 양화로 23길 8', '02-2345-6789', '11:00–21:00 (화 휴무)',
   '대기 소파 옆 / 입구 유리문', 1,
   '[{"id":"director","label":"원장"},{"id":"senior","label":"실장"},{"id":"designer","label":"디자이너"}]'::jsonb,
   'owner_hongdae_f6e5d4c3b2a1')
on conflict (slug) do update set
  name = excluded.name,
  name_translations = excluded.name_translations,
  locales = excluded.locales,
  address = excluded.address,
  tel = excluded.tel,
  business_hours = excluded.business_hours,
  placement_label = excluded.placement_label,
  designer_ranks = excluded.designer_ranks,
  owner_token = excluded.owner_token;

-- 디자이너(스태프) — 살롱당 2명, 고정 id·staff_token·rank_id (memory.ts DEMO_DESIGNERS 와 동일)
insert into public.staff (id, salon_id, salon_slug, name, staff_token, entry_key_version, rank_id)
select d.id, s.id, d.salon_slug, d.name, d.staff_token, 1, d.rank_id
from (values
  ('d_sinsa_minji',   'salon-demo',    '김민지', 'staff_minji_2b9f5c1a4e7d', 'director'),
  ('d_sinsa_jisoo',   'salon-demo',    '박지수', 'staff_jisoo_8a31c7e4f0d2', 'designer'),
  ('d_hongdae_seojun','salon-hongdae', '이서준', 'staff_seojun_7c4e1f9a2d6b', 'senior'),
  ('d_hongdae_hana',  'salon-hongdae', '최하나', 'staff_hana_5d0b3e8a1f64', 'designer')
) as d(id, salon_slug, name, staff_token, rank_id)
join public.salons s on s.slug = d.salon_slug
on conflict (id) do update set
  salon_id = excluded.salon_id,
  salon_slug = excluded.salon_slug,
  name = excluded.name,
  staff_token = excluded.staff_token,
  rank_id = excluded.rank_id;

-- ── 살롱별 편집 카탈로그 (Phase1) — 양 살롱 동일 메뉴, id = `${slug}:${catalogId}` ──
-- 카테고리
insert into public.salon_service_categories (id, salon_slug, label_ko, label_translations, sort_order)
select s.slug || ':' || c.cid, s.slug, c.label_ko, c.label_translations, c.sort_order
from public.salons s
cross join (values
  ('cut',     '컷',       '{"ja":"カット","en":"Cut"}'::jsonb,             1),
  ('perm',    '펌',       '{"ja":"パーマ","en":"Perm"}'::jsonb,           2),
  ('color',   '염색',     '{"ja":"カラー","en":"Color"}'::jsonb,          3),
  ('clinic',  '클리닉',   '{"ja":"トリートメント","en":"Clinic"}'::jsonb, 4),
  ('styling', '스타일링', '{"ja":"スタイリング","en":"Styling"}'::jsonb,  5)
) as c(cid, label_ko, label_translations, sort_order)
on conflict (id) do update set
  label_ko = excluded.label_ko, label_translations = excluded.label_translations,
  sort_order = excluded.sort_order;

-- 서비스 (기존 catalog 가격 그대로. director 직급가 +20% 예시는 컷에만.)
insert into public.salon_services
  (id, salon_slug, category_id, label_ko, label_translations, base_price_from, rank_prices, active)
select
  s.slug || ':' || v.sid, s.slug, s.slug || ':' || v.cid,
  v.label_ko, v.label_translations, v.base_price_from, v.rank_prices, true
from public.salons s
cross join (values
  ('cut_women',     'cut',     '여성 컷',       '{"ja":"レディースカット","en":"Women''s Cut"}'::jsonb,   35000, '{"director":42000}'::jsonb),
  ('cut_men',       'cut',     '남성 컷',       '{"ja":"メンズカット","en":"Men''s Cut"}'::jsonb,         28000, '{"director":33600}'::jsonb),
  ('perm_general',  'perm',    '일반 펌',       '{"ja":"パーマ","en":"Perm"}'::jsonb,                     80000, '{}'::jsonb),
  ('perm_digital',  'perm',    '디지털 펌',     '{"ja":"デジタルパーマ","en":"Digital Perm"}'::jsonb,    120000, '{}'::jsonb),
  ('color_full',    'color',   '전체 염색',     '{"ja":"フルカラー","en":"Full Color"}'::jsonb,           90000, '{}'::jsonb),
  ('color_root',    'color',   '뿌리 염색',     '{"ja":"リタッチ","en":"Root Touch-up"}'::jsonb,          60000, '{}'::jsonb),
  ('color_point',   'color',   '포인트 염색',   '{"ja":"ポイントカラー","en":"Point Color"}'::jsonb,      70000, '{}'::jsonb),
  ('color_bleach',  'color',   '탈색',          '{"ja":"ブリーチ","en":"Bleach"}'::jsonb,                 100000, '{}'::jsonb),
  ('clinic_treatment','clinic','트리트먼트',    '{"ja":"トリートメント","en":"Treatment"}'::jsonb,        50000, '{}'::jsonb),
  ('styling_dry',   'styling', '드라이/스타일링','{"ja":"ブロー/セット","en":"Blow-dry / Styling"}'::jsonb, 30000, '{}'::jsonb),
  ('styling_magic', 'styling', '매직/볼륨매직', '{"ja":"ストレートパーマ","en":"Straightening"}'::jsonb,  90000, '{}'::jsonb)
) as v(sid, cid, label_ko, label_translations, base_price_from, rank_prices)
on conflict (id) do update set
  category_id = excluded.category_id, label_ko = excluded.label_ko,
  label_translations = excluded.label_translations, base_price_from = excluded.base_price_from,
  rank_prices = excluded.rank_prices, active = excluded.active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 서비스 카테고리 / 서비스 (catalog/data.ts SERVICE_CATEGORIES)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.service_categories (id, label_ko, label_translations, icon, sort_order) values
  ('cut',     '컷',       '{"ja":"カット","en":"Cut"}'::jsonb,             '✂️', 1),
  ('perm',    '펌',       '{"ja":"パーマ","en":"Perm"}'::jsonb,           '🌀', 2),
  ('color',   '염색',     '{"ja":"カラー","en":"Color"}'::jsonb,          '🎨', 3),
  ('clinic',  '클리닉',   '{"ja":"トリートメント","en":"Clinic"}'::jsonb, '💧', 4),
  ('styling', '스타일링', '{"ja":"スタイリング","en":"Styling"}'::jsonb,  '💁', 5)
on conflict (id) do update set
  label_ko = excluded.label_ko, label_translations = excluded.label_translations,
  icon = excluded.icon, sort_order = excluded.sort_order;

insert into public.services (id, category_id, label_ko, label_translations, price_from, sort_order) values
  ('cut_women',     'cut',     '여성 컷',       '{"ja":"レディースカット","en":"Women''s Cut"}'::jsonb,   35000, 1),
  ('cut_men',       'cut',     '남성 컷',       '{"ja":"メンズカット","en":"Men''s Cut"}'::jsonb,         28000, 2),
  ('perm_general',  'perm',    '일반 펌',       '{"ja":"パーマ","en":"Perm"}'::jsonb,                     80000, 1),
  ('perm_digital',  'perm',    '디지털 펌',     '{"ja":"デジタルパーマ","en":"Digital Perm"}'::jsonb,    120000, 2),
  ('color_full',    'color',   '전체 염색',     '{"ja":"フルカラー","en":"Full Color"}'::jsonb,           90000, 1),
  ('color_root',    'color',   '뿌리 염색',     '{"ja":"リタッチ","en":"Root Touch-up"}'::jsonb,          60000, 2),
  ('color_point',   'color',   '포인트 염색',   '{"ja":"ポイントカラー","en":"Point Color"}'::jsonb,      70000, 3),
  ('color_bleach',  'color',   '탈색',          '{"ja":"ブリーチ","en":"Bleach"}'::jsonb,                 100000, 4),
  ('clinic_treatment','clinic','트리트먼트',    '{"ja":"トリートメント","en":"Treatment"}'::jsonb,        50000, 1),
  ('styling_dry',   'styling', '드라이/스타일링','{"ja":"ブロー/セット","en":"Blow-dry / Styling"}'::jsonb, 30000, 1),
  ('styling_magic', 'styling', '매직/볼륨매직', '{"ja":"ストレートパーマ","en":"Straightening"}'::jsonb,  90000, 2)
on conflict (id) do update set
  category_id = excluded.category_id, label_ko = excluded.label_ko,
  label_translations = excluded.label_translations, price_from = excluded.price_from,
  sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 얼굴형 (catalog/data.ts FACE_SHAPES)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.face_shapes (id, label_ko, label_translations, icon, sort_order) values
  ('oval',    '계란형',       '{"ja":"卵型","en":"Oval"}'::jsonb,    '🥚', 1),
  ('round',   '둥근형',       '{"ja":"丸顔","en":"Round"}'::jsonb,   '⚪', 2),
  ('square',  '각진형',       '{"ja":"ベース型","en":"Square"}'::jsonb,'⬛', 3),
  ('long',    '긴형',         '{"ja":"面長","en":"Long"}'::jsonb,    '▮', 4),
  ('heart',   '하트형',       '{"ja":"ハート型","en":"Heart"}'::jsonb,'💗', 5),
  ('diamond', '다이아몬드형', '{"ja":"ひし形","en":"Diamond"}'::jsonb,'🔷', 6)
on conflict (id) do update set
  label_ko = excluded.label_ko, label_translations = excluded.label_translations,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 카탈로그 항목들 (catalog_items: crown_volume/hair_density/hair_type/hair_history/concern)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.catalog_items (group_id, id, label_ko, label_translations, icon, sort_order) values
  -- CROWN_VOLUME
  ('crown_volume','high','볼륨 있음', '{"ja":"ボリュームあり","en":"High volume"}'::jsonb, null, 1),
  ('crown_volume','mid', '보통',     '{"ja":"普通","en":"Normal"}'::jsonb,                 null, 2),
  ('crown_volume','low', '볼륨 없음', '{"ja":"ボリュームなし","en":"Flat"}'::jsonb,         null, 3),
  -- HAIR_DENSITY
  ('hair_density','high','많음',     '{"ja":"多い","en":"Thick"}'::jsonb,  null, 1),
  ('hair_density','mid', '보통',     '{"ja":"普通","en":"Normal"}'::jsonb, null, 2),
  ('hair_density','low', '적음',     '{"ja":"少ない","en":"Thin"}'::jsonb, null, 3),
  -- HAIR_TYPE
  ('hair_type','straight','직모',   '{"ja":"直毛","en":"Straight"}'::jsonb,   null, 1),
  ('hair_type','wavy',    '반곱슬', '{"ja":"くせ毛","en":"Wavy"}'::jsonb,      null, 2),
  ('hair_type','curly',   '곱슬',   '{"ja":"強いくせ毛","en":"Curly"}'::jsonb, null, 3),
  -- HAIR_HISTORY
  ('hair_history','bleach_recent','6개월 내 탈색','{"ja":"6ヶ月以内のブリーチ","en":"Bleached within 6 months"}'::jsonb, '⚠️', 1),
  ('hair_history','bleach_old',   '이전 탈색 이력','{"ja":"以前のブリーチ","en":"Bleached before"}'::jsonb,            '🔆', 2),
  ('hair_history','perm_history',  '펌 이력',     '{"ja":"パーマ履歴","en":"Perm history"}'::jsonb,                    '🌀', 3),
  ('hair_history','color_history', '염색 이력',   '{"ja":"カラー履歴","en":"Color history"}'::jsonb,                   '🎨', 4),
  ('hair_history','straighten_history','매직/스트레이트닝','{"ja":"縮毛矯正","en":"Straightening"}'::jsonb,            '📏', 5),
  -- CONCERNS
  ('concern','no_volume',      '볼륨이 없어요',          '{"ja":"ボリュームが出ない","en":"No volume"}'::jsonb,    '📉', 1),
  ('concern','frizzy',         '곱슬이 심해요',          '{"ja":"くせが強い","en":"Very frizzy"}'::jsonb,          '🌪️', 2),
  ('concern','wide_forehead',  '이마가 넓어요',          '{"ja":"おでこが広い","en":"Wide forehead"}'::jsonb,      '🔺', 3),
  ('concern','sensitive_scalp','두피가 예민해요',        '{"ja":"頭皮が敏感","en":"Sensitive scalp"}'::jsonb,      '🌡️', 4),
  ('concern','thin_hair',      '머리숱이 적어요',        '{"ja":"髪が少ない","en":"Thin hair"}'::jsonb,            '🍃', 5),
  ('concern','damaged',        '손상이 심해요',          '{"ja":"ダメージが強い","en":"Very damaged"}'::jsonb,     '🥀', 6),
  ('concern','gray_hair',      '흰머리를 가리고 싶어요', '{"ja":"白髪を隠したい","en":"Cover gray hair"}'::jsonb,  '🤍', 7),
  ('concern','big_face',       '얼굴이 커 보여요',       '{"ja":"顔が大きく見える","en":"Face looks big"}'::jsonb, '🙂', 8)
on conflict (group_id, id) do update set
  label_ko = excluded.label_ko, label_translations = excluded.label_translations,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 퀵리플라이 (catalog/data.ts QUICK_REPLIES) — chip_label 로 멱등 upsert
-- ─────────────────────────────────────────────────────────────────────────────
-- chip_label 은 살롱 전역에서 유일하므로 임시 unique 인덱스로 upsert 가능하게 한다.
create unique index if not exists uq_quick_replies_chip on public.quick_replies(chip_label);

insert into public.quick_replies (intent, chip_label, message, needs_value, value_kind, sort_order) values
  ('greeting','어서오세요',
    '{"ko":"어서오세요! 곧 도와드릴게요 😊","ja":"いらっしゃいませ！すぐにご案内します 😊","en":"Welcome! I''ll help you in just a moment 😊"}'::jsonb,
    false, null, 1),
  ('seat_guide','자리 안내',
    '{"ko":"이쪽 자리로 안내해 드릴게요","ja":"こちらのお席へご案内します","en":"Let me show you to your seat"}'::jsonb,
    false, null, 2),
  ('be_right_there','곧 갈게요',
    '{"ko":"잠시만요, 곧 갈게요","ja":"少々お待ちください、すぐ伺います","en":"One moment, I''ll be right there"}'::jsonb,
    false, null, 3),
  ('available','가능해요',
    '{"ko":"네, 가능합니다 😊","ja":"はい、可能です 😊","en":"Yes, we can do that 😊"}'::jsonb,
    false, null, 4),
  ('conditional','조건부 가능',
    '{"ko":"가능은 한데, 머릿결 상태에 따라 결과가 달라질 수 있어요","ja":"可能ですが、髪の状態によって仕上がりが変わることがあります","en":"We can do it, but the result may vary depending on your hair condition"}'::jsonb,
    false, null, 5),
  ('decline','어려워요',
    '{"ko":"죄송하지만 오늘은 그 시술이 어려울 것 같아요","ja":"申し訳ありませんが、本日はその施術は難しそうです","en":"I''m sorry, that service may not be possible today"}'::jsonb,
    false, null, 6),
  ('checking','확인 중',
    '{"ko":"잠시 확인하고 알려드릴게요","ja":"少し確認してからお知らせします","en":"Let me check and get right back to you"}'::jsonb,
    false, null, 7),
  ('alternative','대안 제안',
    '{"ko":"이렇게 하는 건 어떠세요?","ja":"こちらはいかがですか？","en":"How about this instead?"}'::jsonb,
    false, null, 8),
  ('recommend','추천드려요',
    '{"ko":"고객님께는 이 스타일을 추천드려요","ja":"お客様にはこちらのスタイルがおすすめです","en":"I''d recommend this style for you"}'::jsonb,
    false, null, 9),
  ('request_photo','사진 더',
    '{"ko":"원하는 스타일 사진을 더 보여주세요","ja":"希望のスタイル写真をもっと見せてください","en":"Could you show more photos of the style you want?"}'::jsonb,
    false, null, 10),
  ('price','가격 안내',
    '{"ko":"예상 가격은 {value} 입니다","ja":"目安の料金は {value} です","en":"The estimated price is {value}"}'::jsonb,
    true, 'price', 11),
  ('time','소요시간',
    '{"ko":"약 {value} 걸립니다","ja":"約 {value} かかります","en":"It takes about {value}"}'::jsonb,
    true, 'time', 12),
  ('step_update','지금 진행 중',
    '{"ko":"지금 시술을 진행하고 있어요","ja":"ただいま施術を進めています","en":"We''re working on your service now"}'::jsonb,
    false, null, 13),
  ('step_update','마무리 단계',
    '{"ko":"이제 마무리 단계예요, 거의 다 됐어요","ja":"もうすぐ仕上げです、ほとんど完成です","en":"We''re in the final step now, almost done"}'::jsonb,
    false, null, 14),
  ('step_update','조금만 더',
    '{"ko":"조금만 더 기다려 주세요","ja":"もう少しお待ちください","en":"Just a little longer, please"}'::jsonb,
    false, null, 15),
  ('closing','다 됐어요',
    '{"ko":"다 끝났어요! 마음에 드셨으면 좋겠어요 😊","ja":"完成しました！気に入っていただけたら嬉しいです 😊","en":"All done! I hope you love it 😊"}'::jsonb,
    false, null, 16),
  ('closing','또 오세요',
    '{"ko":"오늘 와주셔서 감사합니다. 또 들러주세요!","ja":"本日はご来店ありがとうございました。またお越しください！","en":"Thank you for coming in today. Please visit us again!"}'::jsonb,
    false, null, 17)
on conflict (chip_label) do update set
  intent = excluded.intent, message = excluded.message,
  needs_value = excluded.needs_value, value_kind = excluded.value_kind,
  sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 소요시간 프리셋 (catalog/data.ts TIME_PRESETS)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.time_presets (minutes, label, sort_order) values
  (15,  '{"ko":"15분","ja":"15分","en":"15 min"}'::jsonb,         1),
  (30,  '{"ko":"30분","ja":"30分","en":"30 min"}'::jsonb,         2),
  (45,  '{"ko":"45분","ja":"45分","en":"45 min"}'::jsonb,         3),
  (60,  '{"ko":"1시간","ja":"1時間","en":"1 hour"}'::jsonb,        4),
  (90,  '{"ko":"1시간 30분","ja":"1時間30分","en":"1.5 hours"}'::jsonb, 5),
  (120, '{"ko":"2시간","ja":"2時間","en":"2 hours"}'::jsonb,       6)
on conflict (minutes) do update set label = excluded.label, sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 제품 카탈로그 (catalog/data.ts PRODUCTS) — 살롱별 인스턴스로 시드(양 살롱 공통)
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists uq_products_salon_catalog on public.products(salon_id, catalog_id);

insert into public.products (salon_id, catalog_id, label_ko, label_translations, icon)
select s.id, p.catalog_id, p.label_ko, p.label_translations, p.icon
from public.salons s
cross join (values
  ('color_dye',       '컬러제(염모제)',        '{"ja":"カラー剤","en":"Color dye"}'::jsonb,            '🎨'),
  ('bleach',          '블리치(탈색제)',        '{"ja":"ブリーチ剤","en":"Bleach"}'::jsonb,             '⚪'),
  ('perm_lotion_1',   '펌 1제',               '{"ja":"パーマ1剤","en":"Perm lotion (1st)"}'::jsonb,  '🧴'),
  ('perm_lotion_2',   '펌 2제',               '{"ja":"パーマ2剤","en":"Perm lotion (2nd)"}'::jsonb,  '🧴'),
  ('neutralizer',     '중화제',               '{"ja":"中和剤","en":"Neutralizer"}'::jsonb,            '💧'),
  ('treatment',       '트리트먼트',            '{"ja":"トリートメント","en":"Treatment"}'::jsonb,      '✨'),
  ('scalp_tonic',     '두피 토닉',            '{"ja":"頭皮トニック","en":"Scalp tonic"}'::jsonb,      '🌿'),
  ('straightener',    '매직약(연화제)',        '{"ja":"縮毛矯正剤","en":"Straightening agent"}'::jsonb,'📏'),
  ('protein',         '단백질 보충제(PPT)',    '{"ja":"プロテイン剤","en":"Protein (PPT)"}'::jsonb,    '🧬'),
  ('scalp_protector', '두피 보호제',          '{"ja":"頭皮保護剤","en":"Scalp protector"}'::jsonb,    '🛡️')
) as p(catalog_id, label_ko, label_translations, icon)
on conflict (salon_id, catalog_id) do update set
  label_ko = excluded.label_ko, label_translations = excluded.label_translations, icon = excluded.icon;
