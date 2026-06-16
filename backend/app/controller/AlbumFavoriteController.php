<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumPage;
use app\model\AlbumFavorite;
use app\model\AlbumCategory;
use think\facade\Db;
use think\Request;

class AlbumFavoriteController
{
    public function toggle(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $favorite = AlbumFavorite::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->find();

        if ($favorite) {
            $favorite->delete();
            return json_success(['favorited' => false], '已取消收藏');
        }

        $favorite = new AlbumFavorite();
        $favorite->user_id = $request->uid;
        $favorite->album_id = $albumId;
        $favorite->save();

        return json_success(['favorited' => true], '收藏成功');
    }

    public function check(Request $request, $albumId)
    {
        $exists = AlbumFavorite::where('user_id', $request->uid)
            ->where('album_id', $albumId)
            ->find();

        return json_success(['favorited' => (bool)$exists]);
    }

    public function batchCheck(Request $request)
    {
        $albumIds = $request->post('album_ids', []);
        if (!is_array($albumIds) || empty($albumIds)) {
            return json_success(['favorites' => []]);
        }

        $albumIds = array_unique(array_map('intval', $albumIds));

        $favorites = AlbumFavorite::where('user_id', $request->uid)
            ->whereIn('album_id', $albumIds)
            ->column('album_id');

        $result = [];
        foreach ($albumIds as $id) {
            $result[$id] = in_array($id, $favorites);
        }

        return json_success(['favorites' => $result]);
    }

    public function myList(Request $request)
    {
        $page = $request->get('page', 1);
        $limit = $request->get('limit', 12);
        $categoryId = $request->get('category_id', '');
        $sort = $request->get('sort', 'created_at');

        $query = AlbumFavorite::with(['album' => function ($q) {
            $q->with(['category']);
        }])
            ->where('album_favorites.user_id', $request->uid)
            ->alias('f')
            ->join('albums a', 'f.album_id = a.id');

        if ($categoryId !== '') {
            $query->where('a.category_id', $categoryId);
        }

        if ($sort === 'category') {
            $query->order('a.category_id', 'asc')->order('f.created_at', 'desc');
        } else {
            $query->order('f.created_at', 'desc');
        }

        $total = $query->count();
        $list = $query->page($page, $limit)
            ->select()
            ->each(function ($item) {
                if ($item->album) {
                    $album = $item->album;
                    $album->cover_image_url = $album->cover_image ? get_upload_url($album->cover_image) : '';
                    $album->has_password = !empty($album->share_password);
                    $album->page_count = AlbumPage::where('album_id', $album->id)->count();
                    unset($album->share_password);
                    $album->favorited_at = $item->created_at;
                }
                return $item;
            });

        $albumList = [];
        foreach ($list as $item) {
            if ($item->album && $item->album->status === 1) {
                $albumList[] = $item->album;
            }
        }

        return json_success([
            'list'  => $albumList,
            'total' => $total,
            'page'  => (int)$page,
            'limit' => (int)$limit,
        ]);
    }

    public function countByAlbum($albumId)
    {
        $count = AlbumFavorite::where('album_id', $albumId)->count();
        return json_success(['count' => $count]);
    }
}
