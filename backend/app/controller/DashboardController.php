<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\User;
use app\model\AlbumCategory;
use app\model\AccessLog;
use think\Request;

class DashboardController
{
    public function stats(Request $request)
    {
        $albumCount = Album::count();
        $publishedCount = Album::where('status', 1)->count();
        $pageCount = AlbumPage::count();
        $userCount = User::count();
        $categoryCount = AlbumCategory::where('status', 1)->count();
        $totalViews = Album::sum('view_count');
        $todayViews = AccessLog::whereDay('created_at')->count();

        $recentAlbums = Album::with(['category'])
            ->order('created_at', 'desc')
            ->limit(5)
            ->select()
            ->each(function ($item) {
                $item->cover_image_url = $item->cover_image ? get_upload_url($item->cover_image) : '';
                $item->page_count = AlbumPage::where('album_id', $item->id)->count();
                return $item;
            });

        $recentUsers = User::order('created_at', 'desc')
            ->limit(5)
            ->field('id,username,nickname,role,status,created_at')
            ->select();

        return json_success([
            'album_count'     => $albumCount,
            'published_count' => $publishedCount,
            'page_count'      => $pageCount,
            'user_count'      => $userCount,
            'category_count'  => $categoryCount,
            'total_views'     => $totalViews,
            'today_views'     => $todayViews,
            'recent_albums'   => $recentAlbums,
            'recent_users'    => $recentUsers,
        ]);
    }
}
