<?php

namespace app\controller;

use app\model\AuditLog;
use app\model\User;
use think\facade\Db;
use think\Request;

class AuditLogController
{
    public function index(Request $request)
    {
        $page = (int)$request->get('page', 1);
        $limit = (int)$request->get('limit', 20);
        if ($limit > 100) $limit = 100;

        $operatorId = $request->get('operator_id', '');
        $actionType = $request->get('action_type', '');
        $targetType = $request->get('target_type', '');
        $startDate = $request->get('start_date', '');
        $endDate = $request->get('end_date', '');
        $keyword = $request->get('keyword', '');

        $query = AuditLog::order('id', 'desc');

        if ($operatorId !== '') {
            $query->byOperator((int)$operatorId);
        }
        if ($actionType !== '') {
            $query->byActionType($actionType);
        }
        if ($targetType !== '') {
            $query->byTargetType($targetType);
        }
        if ($startDate !== '' || $endDate !== '') {
            $query->byDateRange($startDate, $endDate);
        }
        if ($keyword !== '') {
            $query->byKeyword($keyword);
        }

        $total = $query->count();
        $list = $query
            ->page($page, $limit)
            ->select()
            ->each(function ($item) {
                $item->action_type_text = $item->action_type_text_attr;
                $item->target_type_text = $item->target_type_text_attr;
                $item->role_text = $this->getRoleText($item->operator_role);
                unset($item->user_agent);
                return $item;
            });

        return json_success([
            'list'  => $list,
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
        ]);
    }

    public function detail(Request $request, $id)
    {
        $log = AuditLog::find($id);
        if (!$log) {
            return json_error('日志不存在', 404);
        }

        $log->action_type_text = $log->action_type_text_attr;
        $log->target_type_text = $log->target_type_text_attr;
        $log->role_text = $this->getRoleText($log->operator_role);

        $changeSummary = $log->change_summary;
        $changes = [];
        if (!empty($changeSummary) && is_array($changeSummary)) {
            $before = $changeSummary['before'] ?? [];
            $after = $changeSummary['after'] ?? [];
            $allKeys = array_unique(array_merge(array_keys($before), array_keys($after)));
            foreach ($allKeys as $key) {
                $changes[] = [
                    'field'  => $key,
                    'label'  => $before[$key]['label'] ?? $after[$key]['label'] ?? $key,
                    'before' => $before[$key]['value'] ?? null,
                    'after'  => $after[$key]['value'] ?? null,
                ];
            }
        }
        $log->changes = $changes;

        return json_success($log);
    }

    public function meta()
    {
        $operators = User::field('id, username, nickname, role')
            ->where('role', 'admin')
            ->whereOr('role', 'user')
            ->order('role', 'desc')
            ->order('id', 'asc')
            ->limit(100)
            ->select()
            ->each(function ($item) {
                $item->display_name = $item->nickname ?: $item->username;
                return $item;
            });

        $totalCount = AuditLog::count();
        $todayCount = AuditLog::where('created_at', '>=', date('Y-m-d 00:00:00'))->count();
        $weekCount = AuditLog::where('created_at', '>=', date('Y-m-d 00:00:00', strtotime('-7 days')))->count();

        $stats = [
            'total_count' => $totalCount,
            'today_count' => $todayCount,
            'week_count'  => $weekCount,
        ];

        $oldestDate = AuditLog::min('created_at');
        if ($oldestDate) {
            $stats['oldest_date'] = substr($oldestDate, 0, 10);
        }

        return json_success([
            'action_types' => AuditLog::actionTypes(),
            'target_types' => AuditLog::targetTypes(),
            'operators'    => $operators,
            'stats'        => $stats,
        ]);
    }

    public function archive(Request $request)
    {
        $days = (int)$request->post('days', 90);
        if ($days < 30) $days = 30;

        $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        $totalToArchive = AuditLog::where('created_at', '<', $cutoffDate)->count();
        if ($totalToArchive === 0) {
            return json_success([
                'archived_count' => 0,
                'message'        => '没有需要归档的日志',
            ]);
        }

        $archiveTableName = 'audit_logs_archive_' . date('Y_m');
        $createTableSql = "CREATE TABLE IF NOT EXISTS `{$archiveTableName}` LIKE `audit_logs`";

        try {
            Db::execute($createTableSql);

            $batchSize = 1000;
            $archived = 0;

            while ($archived < $totalToArchive) {
                $ids = AuditLog::where('created_at', '<', $cutoffDate)
                    ->limit($batchSize)
                    ->column('id');

                if (empty($ids)) break;

                $idsStr = implode(',', array_map('intval', $ids));

                Db::startTrans();
                try {
                    Db::execute("INSERT INTO `{$archiveTableName}` SELECT * FROM `audit_logs` WHERE id IN ({$idsStr})");
                    Db::execute("DELETE FROM `audit_logs` WHERE id IN ({$idsStr})");
                    Db::commit();
                    $archived += count($ids);
                } catch (\Exception $e) {
                    Db::rollback();
                    throw $e;
                }
            }

            return json_success([
                'archived_count' => $archived,
                'archive_table'  => $archiveTableName,
                'cutoff_date'    => $cutoffDate,
            ]);
        } catch (\Exception $e) {
            return json_error('归档失败: ' . $e->getMessage());
        }
    }

    private function getRoleText(string $role): string
    {
        $map = [
            'admin' => '管理员',
            'user'  => '用户',
            'guest' => '访客',
        ];
        return $map[$role] ?? $role;
    }
}
