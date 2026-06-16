<?php

namespace app\controller;

use app\model\Album;
use app\model\AlbumSnapshot;
use app\service\AlbumSnapshotService;
use think\facade\Log;
use think\Request;

class AlbumSnapshotController
{
    public function index(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $result = AlbumSnapshotService::getSnapshotList($albumId, $page, $limit);

        return json_success($result);
    }

    public function detail(Request $request, $albumId, $id)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        try {
            $snapshot = AlbumSnapshotService::getSnapshotDetail($albumId, $id);
            return json_success($snapshot);
        } catch (\Exception $e) {
            return json_error($e->getMessage(), 404);
        }
    }

    public function diff(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $snapshotId1 = $request->get('snapshot_id_1');
        $snapshotId2 = $request->get('snapshot_id_2');

        if (!$snapshotId1 || !$snapshotId2) {
            return json_error('请提供两个快照ID');
        }

        try {
            $diff = AlbumSnapshotService::compareSnapshots($albumId, $snapshotId1, $snapshotId2);
            return json_success($diff);
        } catch (\Exception $e) {
            return json_error($e->getMessage());
        }
    }

    public function rollback(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = getRequestData($request);
        $snapshotId = $data['snapshot_id'] ?? null;

        if (!$snapshotId) {
            return json_error('请提供要回滚的快照ID');
        }

        $targetSnapshot = AlbumSnapshot::where('album_id', $albumId)->where('id', $snapshotId)->find();
        if (!$targetSnapshot) {
            return json_error('目标快照不存在', 404);
        }

        try {
            $result = AlbumSnapshotService::rollbackToSnapshot($albumId, $snapshotId, $request->uid);
            return json_success($result, '回滚成功，已生成新快照');
        } catch (\Exception $e) {
            Log::error("画册回滚失败: album_id={$albumId}, snapshot_id={$snapshotId}, error=" . $e->getMessage());
            return json_error('回滚失败: ' . $e->getMessage());
        }
    }

    public function createManual(Request $request, $albumId)
    {
        $album = Album::find($albumId);
        if (!$album) {
            return json_error('画册不存在', 404);
        }

        $data = getRequestData($request);
        $remark = $data['remark'] ?? '';

        try {
            $snapshot = AlbumSnapshotService::createSnapshot($albumId, $request->uid, $remark);
            return json_success([
                'id' => $snapshot->id,
                'version' => $snapshot->version,
                'page_count' => $snapshot->page_count,
                'size_kb' => round($snapshot->size_bytes / 1024, 1),
            ], '快照创建成功');
        } catch (\Exception $e) {
            Log::error("手动创建快照失败: album_id={$albumId}, error=" . $e->getMessage());
            return json_error('创建快照失败: ' . $e->getMessage());
        }
    }
}
