<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\AlbumReadProgress;
use app\model\DailyQuota;
use app\model\User;
use app\model\MemberLevel;
use think\facade\Validate;
use think\Request;

class ReadingProgressController
{
    public function getProgress(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $userId = 0;
        $visitorKey = '';
        $tokenAuthenticated = false;

        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload && !empty($payload['uid'])) {
                $userId = (int)$payload['uid'];
                $tokenAuthenticated = true;
            }
        }

        if ($tokenAuthenticated && $userId > 0) {
            $progress = AlbumReadProgress::where('user_id', $userId)
                ->where('album_id', $albumId)
                ->find();
        } else {
            $ip = $request->ip();
            $userAgent = $request->header('user-agent', '');
            $visitorKey = DailyQuota::getVisitorKey($ip, $userAgent);
            $progress = AlbumReadProgress::where('visitor_key', $visitorKey)
                ->where('album_id', $albumId)
                ->find();
        }

        if (!$progress) {
            return json_success([
                'has_progress'  => false,
                'current_page'  => 1,
                'total_pages'   => 0,
                'is_completed'  => false,
                'last_read_at'  => null,
            ]);
        }

        $currentTotalPages = AlbumPage::where('album_id', $albumId)->count();
        $correctedPage = $progress->current_page;
        $correctedCompleted = (bool)$progress->is_completed;

        if ($currentTotalPages > 0 && $correctedPage > $currentTotalPages) {
            $correctedPage = $currentTotalPages;
        }
        if ($currentTotalPages > 0 && $correctedPage >= $currentTotalPages) {
            $correctedCompleted = true;
        }
        if ($correctedPage < 1) {
            $correctedPage = 1;
        }

        return json_success([
            'has_progress'     => true,
            'current_page'     => (int)$correctedPage,
            'original_page'    => (int)$progress->current_page,
            'recorded_total'   => (int)$progress->total_pages,
            'actual_total'     => (int)$currentTotalPages,
            'page_corrected'   => $correctedPage !== (int)$progress->current_page,
            'is_completed'     => $correctedCompleted,
            'last_read_at'     => $progress->last_read_at,
        ]);
    }

    public function saveProgress(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = $request->post();

        $validate = Validate::rule([
            'current_page' => 'require|integer|>=:1',
            'total_pages'  => 'integer|>=:0',
        ])->message([
            'current_page.require' => '当前页码不能为空',
            'current_page.integer' => '当前页码必须为整数',
            'current_page.>='      => '当前页码必须大于等于1',
            'total_pages.integer'  => '总页数必须为整数',
        ]);

        if (!$validate->check($data)) {
            return json_error($validate->getError());
        }

        $userId = 0;
        $visitorKey = '';
        $tokenAuthenticated = false;

        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload && !empty($payload['uid'])) {
                $userId = (int)$payload['uid'];
                $tokenAuthenticated = true;
            }
        }

        $currentPage = (int)$data['current_page'];
        $totalPages = isset($data['total_pages']) ? (int)$data['total_pages'] : AlbumPage::where('album_id', $albumId)->count();

        if ($totalPages > 0 && $currentPage > $totalPages) {
            $currentPage = $totalPages;
        }
        if ($currentPage < 1) {
            $currentPage = 1;
        }

        $isCompleted = ($totalPages > 0 && $currentPage >= $totalPages) ? 1 : 0;

        if ($tokenAuthenticated && $userId > 0) {
            $progress = AlbumReadProgress::where('user_id', $userId)
                ->where('album_id', $albumId)
                ->find();

            if (!$progress) {
                $progress = new AlbumReadProgress();
                $progress->user_id = $userId;
                $progress->visitor_key = '';
                $progress->album_id = $albumId;
            } else {
                if ((int)$progress->user_id !== $userId) {
                    return json_error('无权修改此进度', 403);
                }
                $progress->visitor_key = '';
            }
        } else {
            $ip = $request->ip();
            $userAgent = $request->header('user-agent', '');
            $visitorKey = DailyQuota::getVisitorKey($ip, $userAgent);

            $progress = AlbumReadProgress::where('visitor_key', $visitorKey)
                ->where('album_id', $albumId)
                ->find();

            if (!$progress) {
                $progress = new AlbumReadProgress();
                $progress->user_id = 0;
                $progress->visitor_key = $visitorKey;
                $progress->album_id = $albumId;
            } else {
                if ($progress->visitor_key !== $visitorKey) {
                    return json_error('无权修改此进度', 403);
                }
                $progress->user_id = 0;
            }
        }

        $progress->current_page = $currentPage;
        $progress->total_pages = $totalPages;
        $progress->is_completed = $isCompleted;
        $progress->save();

        return json_success([
            'current_page' => $currentPage,
            'total_pages'  => $totalPages,
            'is_completed' => (bool)$isCompleted,
            'last_read_at' => $progress->last_read_at,
            'user_id'      => (int)$progress->user_id,
            'is_visitor'   => !$tokenAuthenticated,
        ], '进度已保存');
    }

    public function batchGetProgress(Request $request)
    {
        $albumIds = $request->post('album_ids', []);
        if (empty($albumIds) || !is_array($albumIds)) {
            return json_success([]);
        }

        $albumIds = array_map('intval', $albumIds);
        $albumIds = array_unique(array_filter($albumIds));

        if (empty($albumIds)) {
            return json_success([]);
        }

        $userId = 0;
        $visitorKey = '';
        $tokenAuthenticated = false;

        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload && !empty($payload['uid'])) {
                $userId = (int)$payload['uid'];
                $tokenAuthenticated = true;
            }
        }

        if ($tokenAuthenticated && $userId > 0) {
            $list = AlbumReadProgress::where('user_id', $userId)
                ->whereIn('album_id', $albumIds)
                ->select();
        } else {
            $ip = $request->ip();
            $userAgent = $request->header('user-agent', '');
            $visitorKey = DailyQuota::getVisitorKey($ip, $userAgent);
            $list = AlbumReadProgress::where('visitor_key', $visitorKey)
                ->whereIn('album_id', $albumIds)
                ->select();
        }

        $result = [];
        foreach ($list as $item) {
            $actualTotal = AlbumPage::where('album_id', $item->album_id)->count();
            $correctedPage = $item->current_page;
            if ($actualTotal > 0 && $correctedPage > $actualTotal) {
                $correctedPage = $actualTotal;
            }
            if ($correctedPage < 1) {
                $correctedPage = 1;
            }
            $isCompleted = ($actualTotal > 0 && $correctedPage >= $actualTotal) ? true : (bool)$item->is_completed;

            $result[$item->album_id] = [
                'album_id'     => (int)$item->album_id,
                'current_page' => (int)$correctedPage,
                'total_pages'  => (int)$actualTotal,
                'is_completed' => $isCompleted,
                'progress'     => $actualTotal > 0 ? min(100, round(($correctedPage / $actualTotal) * 100)) : 0,
                'last_read_at' => $item->last_read_at,
            ];
        }

        return json_success($result);
    }

    public function myUnfinishedList(Request $request)
    {
        $userId = 0;
        $visitorKey = '';
        $user = null;
        $userLevel = 0;
        $isAdmin = false;
        $tokenAuthenticated = false;

        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload && !empty($payload['uid'])) {
                $userId = (int)$payload['uid'];
                $tokenAuthenticated = true;
                $user = User::find($userId);
                if ($user) {
                    $level = MemberLevel::find($user->member_level_id);
                    $userLevel = $level ? $level->level : 0;
                    $isAdmin = $user->role === 'admin';
                }
            }
        }

        if ($tokenAuthenticated && $userId > 0) {
            $query = AlbumReadProgress::where('user_id', $userId);
        } else {
            $ip = $request->ip();
            $userAgent = $request->header('user-agent', '');
            $visitorKey = DailyQuota::getVisitorKey($ip, $userAgent);
            $query = AlbumReadProgress::where('visitor_key', $visitorKey);
        }

        $list = $query
            ->where('is_completed', 0)
            ->order('last_read_at', 'desc')
            ->limit(20)
            ->select();

        if ($list->isEmpty()) {
            return json_success([]);
        }

        $albumIds = $list->column('album_id');
        $albums = Album::with(['category'])
            ->whereIn('id', $albumIds)
            ->where('status', 1)
            ->select()
            ->keyBy('id');

        $pageCounts = AlbumPage::whereIn('album_id', $albumIds)
            ->field('album_id, COUNT(*) as cnt')
            ->group('album_id')
            ->select()
            ->column('cnt', 'album_id');

        $result = [];
        foreach ($list as $item) {
            $album = $albums[$item->album_id] ?? null;
            if (!$album) continue;

            if (!$isAdmin && $album->min_level > $userLevel) {
                continue;
            }

            $actualTotal = (int)($pageCounts[$item->album_id] ?? 0);
            $correctedPage = $item->current_page;
            if ($actualTotal > 0 && $correctedPage > $actualTotal) {
                $correctedPage = $actualTotal;
            }
            if ($correctedPage < 1) {
                $correctedPage = 1;
            }
            $isCompleted = ($actualTotal > 0 && $correctedPage >= $actualTotal);

            $result[] = [
                'album' => [
                    'id'                   => $album->id,
                    'title'                => $album->title,
                    'description'          => $album->description,
                    'cover_image_url'      => $album->cover_image ? get_upload_url($album->cover_image) : '',
                    'category'             => $album->category,
                    'view_count'           => $album->view_count,
                    'page_count'           => $actualTotal,
                ],
                'progress' => [
                    'current_page' => (int)$correctedPage,
                    'total_pages'  => $actualTotal,
                    'is_completed' => $isCompleted,
                    'percent'      => $actualTotal > 0 ? min(100, round(($correctedPage / $actualTotal) * 100)) : 0,
                    'last_read_at' => $item->last_read_at,
                ],
            ];
        }

        return json_success($result);
    }

    public function mergeLocalProgress(Request $request)
    {
        $userId = 0;
        $tokenAuthenticated = false;
        $token = $request->header('Authorization', '');
        if (str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if (!empty($token)) {
            $payload = verify_token($token);
            if ($payload && !empty($payload['uid'])) {
                $userId = (int)$payload['uid'];
                $tokenAuthenticated = true;
            }
        }

        if (!$tokenAuthenticated || $userId <= 0) {
            return json_error('请先登录', 401);
        }

        $localList = $request->post('progress_list', []);
        if (empty($localList) || !is_array($localList)) {
            return json_success(['merged' => 0, 'updated' => 0]);
        }

        $mergedCount = 0;
        $updatedCount = 0;

        foreach ($localList as $localItem) {
            $albumId = (int)($localItem['album_id'] ?? 0);
            $localPage = (int)($localItem['current_page'] ?? 1);
            $localTotal = (int)($localItem['total_pages'] ?? 0);
            $localLastRead = $localItem['last_read_at'] ?? null;

            if ($albumId <= 0) continue;

            $album = Album::find($albumId);
            if (!$album) continue;

            $actualTotal = AlbumPage::where('album_id', $albumId)->count();
            if ($localTotal > 0 && $actualTotal > 0) {
                if ($localPage > $actualTotal) $localPage = $actualTotal;
            }
            if ($localPage < 1) $localPage = 1;

            $localTime = $localLastRead ? strtotime($localLastRead) : 0;

            $cloudProgress = AlbumReadProgress::where('user_id', $userId)
                ->where('album_id', $albumId)
                ->find();

            if (!$cloudProgress) {
                $progress = new AlbumReadProgress();
                $progress->user_id = $userId;
                $progress->visitor_key = '';
                $progress->album_id = $albumId;
                $progress->current_page = $localPage;
                $progress->total_pages = $actualTotal > 0 ? $actualTotal : $localTotal;
                $progress->is_completed = ($actualTotal > 0 && $localPage >= $actualTotal) ? 1 : 0;
                $progress->save();
                $mergedCount++;
            } else {
                $cloudTime = strtotime($cloudProgress->last_read_at);
                if ($localTime > $cloudTime || $localPage > $cloudProgress->current_page) {
                    $cloudPage = $cloudProgress->current_page;
                    $newPage = max($cloudPage, $localPage);
                    if ($actualTotal > 0 && $newPage > $actualTotal) $newPage = $actualTotal;
                    if ($newPage < 1) $newPage = 1;

                    $cloudProgress->current_page = $newPage;
                    $cloudProgress->total_pages = $actualTotal > 0 ? $actualTotal : max($cloudProgress->total_pages, $localTotal);
                    $cloudProgress->is_completed = ($cloudProgress->total_pages > 0 && $newPage >= $cloudProgress->total_pages) ? 1 : 0;
                    $cloudProgress->save();
                    $updatedCount++;
                }
            }
        }

        return json_success([
            'merged'  => $mergedCount,
            'updated' => $updatedCount,
        ], '本地进度已合并');
    }
}
