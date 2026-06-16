SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS flipbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flipbook;

-- 会员等级表
CREATE TABLE IF NOT EXISTS `member_levels` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL COMMENT '等级名称',
  `level` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '等级值，数值越大权限越高',
  `description` VARCHAR(255) DEFAULT '' COMMENT '等级描述',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员等级表';

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码(bcrypt)',
  `nickname` VARCHAR(100) DEFAULT '' COMMENT '昵称',
  `email` VARCHAR(100) DEFAULT '' COMMENT '邮箱',
  `phone` VARCHAR(20) DEFAULT '' COMMENT '手机号',
  `avatar` VARCHAR(500) DEFAULT '' COMMENT '头像',
  `role` ENUM('admin','user') NOT NULL DEFAULT 'user' COMMENT '角色',
  `member_level_id` INT UNSIGNED DEFAULT 1 COMMENT '会员等级ID',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态 1启用 0禁用',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_member_level` (`member_level_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 画册分类表
CREATE TABLE IF NOT EXISTS `album_categories` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画册分类表';

-- 画册表
CREATE TABLE IF NOT EXISTS `albums` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL COMMENT '画册标题',
  `description` TEXT COMMENT '画册描述',
  `cover_image` VARCHAR(500) DEFAULT '' COMMENT '封面图片',
  `background_image` VARCHAR(500) DEFAULT '' COMMENT '背景图片',
  `category_id` INT UNSIGNED DEFAULT NULL COMMENT '分类ID',
  `min_level` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '最低访问等级',
  `share_password` VARCHAR(50) DEFAULT '' COMMENT '分享密码',
  `qrcode_image` VARCHAR(500) DEFAULT '' COMMENT '二维码图片路径',
  `qrcode_logo` VARCHAR(500) DEFAULT '' COMMENT '二维码Logo路径',
  `qrcode_text_line1` VARCHAR(100) DEFAULT '' COMMENT '二维码文字行1',
  `qrcode_text_line2` VARCHAR(100) DEFAULT '' COMMENT '二维码文字行2',
  `view_count` INT UNSIGNED DEFAULT 0 COMMENT '浏览次数',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态 1发布 0草稿',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `creator_id` INT UNSIGNED DEFAULT NULL COMMENT '创建者ID',
  `watermark_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用水印 0关闭 1开启',
  `watermark_text` VARCHAR(200) DEFAULT '' COMMENT '水印文字，支持{用户名}{日期}{IP后两段}占位符',
  `watermark_opacity` DECIMAL(3,2) DEFAULT 0.15 COMMENT '水印透明度 0-1',
  `watermark_density` TINYINT UNSIGNED DEFAULT 3 COMMENT '水印平铺密度 1-5 数值越大越密',
  `watermark_color` VARCHAR(20) DEFAULT '#000000' COMMENT '水印颜色',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_category` (`category_id`),
  KEY `idx_status` (`status`),
  KEY `idx_min_level` (`min_level`),
  KEY `idx_creator` (`creator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画册表';

-- 画册页面表
CREATE TABLE IF NOT EXISTS `album_pages` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `album_id` INT UNSIGNED NOT NULL COMMENT '画册ID',
  `page_number` INT UNSIGNED NOT NULL COMMENT '页码',
  `image` VARCHAR(500) NOT NULL COMMENT '页面图片',
  `title` VARCHAR(200) DEFAULT '' COMMENT '页面标题',
  `description` TEXT COMMENT '页面描述',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_album` (`album_id`),
  KEY `idx_page_number` (`album_id`, `page_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画册页面表';

-- 画册书签表
CREATE TABLE IF NOT EXISTS `album_bookmarks` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `album_id` INT UNSIGNED NOT NULL COMMENT '画册ID',
  `page_number` INT UNSIGNED NOT NULL COMMENT '页码',
  `note` VARCHAR(200) DEFAULT '' COMMENT '书签备注',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_album_page` (`user_id`, `album_id`, `page_number`),
  KEY `idx_user_album` (`user_id`, `album_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='画册书签表';

-- 背景图片库
CREATE TABLE IF NOT EXISTS `background_images` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL COMMENT '图片名称',
  `path` VARCHAR(500) NOT NULL COMMENT '图片路径',
  `thumb_path` VARCHAR(500) DEFAULT '' COMMENT '缩略图路径',
  `category` VARCHAR(50) DEFAULT 'default' COMMENT '分类',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='背景图片库';

-- 访问日志表
CREATE TABLE IF NOT EXISTS `access_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `album_id` INT UNSIGNED NOT NULL COMMENT '画册ID',
  `user_id` INT UNSIGNED DEFAULT NULL COMMENT '用户ID',
  `ip` VARCHAR(45) DEFAULT '' COMMENT 'IP地址',
  `user_agent` VARCHAR(500) DEFAULT '' COMMENT 'UserAgent',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_album` (`album_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='访问日志表';

-- 初始化会员等级
INSERT INTO `member_levels` (`id`, `name`, `level`, `description`) VALUES
(1, '普通会员', 0, '注册即为普通会员，可浏览公开画册'),
(2, '银牌会员', 1, '银牌会员，可浏览银牌及以下等级画册'),
(3, '金牌会员', 2, '金牌会员，可浏览金牌及以下等级画册'),
(4, 'VIP会员', 3, 'VIP会员，可浏览所有画册');

-- 初始化管理员账户 (密码会在应用启动时通过PHP bcrypt重新生成)
INSERT INTO `users` (`id`, `username`, `password`, `nickname`, `role`, `member_level_id`, `status`) VALUES
(1, 'admin', '$2y$10$placeholder', '系统管理员', 'admin', 4, 1);

-- 初始化测试用户
INSERT INTO `users` (`id`, `username`, `password`, `nickname`, `role`, `member_level_id`, `status`) VALUES
(2, 'testuser', '$2y$10$placeholder', '测试用户', 'user', 1, 1),
(3, 'vipuser', '$2y$10$placeholder', 'VIP用户', 'user', 4, 1);

-- 初始化画册分类
INSERT INTO `album_categories` (`id`, `name`, `sort_order`, `status`) VALUES
(1, '企业宣传', 1, 1),
(2, '产品展示', 2, 1),
(3, '活动相册', 3, 1),
(4, '个人写真', 4, 1);

-- 初始化示例画册
INSERT INTO `albums` (`id`, `title`, `description`, `cover_image`, `background_image`, `category_id`, `min_level`, `status`, `creator_id`, `qrcode_text_line1`, `qrcode_text_line2`) VALUES
(1, '企业形象宣传册', '展示公司文化、团队风采和发展历程的精美画册', '/images/cover1.png', '/images/bg1.png', 1, 0, 1, 1, '扫码查看画册', '企业形象宣传册'),
(2, '2024年度产品目录', '最新产品展示与技术参数详细目录', '/images/cover2.png', '/images/bg2.png', 2, 1, 1, 1, '扫码查看产品', '2024产品目录'),
(3, '年会精彩瞬间', '记录公司年度盛典的精彩时刻', '/images/cover3.png', '/images/bg3.png', 3, 2, 1, 1, '扫码回顾年会', '2024年度盛典');

-- 初始化示例画册页面
INSERT INTO `album_pages` (`album_id`, `page_number`, `image`, `title`, `sort_order`) VALUES
(1, 1, '/images/a1-p1.png', '企业大厦', 0),
(1, 2, '/images/a1-p2.png', '团队风采', 1),
(1, 3, '/images/a1-p3.png', '办公环境', 2),
(1, 4, '/images/a1-p4.png', '发展趋势', 3),
(2, 1, '/images/a2-p1.png', '科技配件', 0),
(2, 2, '/images/a2-p2.png', '智能家居', 1),
(2, 3, '/images/a2-p3.png', '智能手表', 2),
(2, 4, '/images/a2-p4.png', '无线耳机', 3),
(3, 1, '/images/a3-p1.png', '盛典舞台', 0),
(3, 2, '/images/a3-p2.png', '欢庆时刻', 1),
(3, 3, '/images/a3-p3.png', '颁奖典礼', 2),
(3, 4, '/images/a3-p4.png', '晚宴盛况', 3);

-- 初始化背景图片库
INSERT INTO `background_images` (`name`, `path`, `category`, `created_at`) VALUES
('商务蓝色科技', '/images/bg1.png', 'default', NOW()),
('简约白色纹理', '/images/bg2.png', 'default', NOW()),
('暖色渐变波浪', '/images/bg3.png', 'default', NOW());
