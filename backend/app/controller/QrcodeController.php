<?php

namespace app\controller;

use app\model\Album;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel\ErrorCorrectionLevelHigh;
use Endroid\QrCode\Color\Color;
use Endroid\QrCode\RoundBlockSizeMode\RoundBlockSizeModeMargin;
use Endroid\QrCode\Logo\Logo;
use app\service\AuditWriter;
use think\facade\Log;
use think\Request;

class QrcodeController
{
    public function generate(Request $request)
    {
        $albumId = $request->post('album_id', 0);
        $content = $request->post('content', '');
        $logoPath = $request->post('logo', '');
        $textLine1 = $request->post('text_line1', '');
        $textLine2 = $request->post('text_line2', '');

        if (empty($content) && $albumId > 0) {
            $frontendUrl = $request->post('frontend_url', 'http://localhost:3000');
            $content = $frontendUrl . '/#/viewer/' . $albumId;
        }

        if (empty($content)) {
            return json_error('二维码内容不能为空');
        }

        try {
            $qrCode = QrCode::create($content)
                ->setEncoding(new Encoding('UTF-8'))
                ->setErrorCorrectionLevel(new ErrorCorrectionLevelHigh())
                ->setSize(400)
                ->setMargin(20)
                ->setRoundBlockSizeMode(new RoundBlockSizeModeMargin())
                ->setForegroundColor(new Color(33, 33, 33))
                ->setBackgroundColor(new Color(255, 255, 255));

            $writer = new PngWriter();

            $logo = null;
            if (!empty($logoPath)) {
                $fullLogoPath = app()->getRootPath() . 'public/uploads/' . $logoPath;
                if (file_exists($fullLogoPath)) {
                    $logo = Logo::create($fullLogoPath)
                        ->setResizeToWidth(80)
                        ->setPunchoutBackground(false);
                }
            }

            $result = $writer->write($qrCode, $logo);

            $qrImageData = $result->getString();

            $finalImage = $this->compositeQrImage($qrImageData, $logoPath, $textLine1, $textLine2);

            $savePath = app()->getRootPath() . 'public/uploads/qrcodes/';
            if (!is_dir($savePath)) {
                mkdir($savePath, 0777, true);
            }

            $filename = 'qr_' . ($albumId ?: 'custom') . '_' . time() . '.png';
            $fullPath = $savePath . $filename;

            imagepng($finalImage, $fullPath);
            imagedestroy($finalImage);

            $relativePath = 'qrcodes/' . $filename;

            if ($albumId > 0) {
                $album = Album::find($albumId);
                if ($album) {
                    $album->qrcode_image = $relativePath;
                    $album->qrcode_text_line1 = $textLine1;
                    $album->qrcode_text_line2 = $textLine2;
                    if (!empty($logoPath)) {
                        $album->qrcode_logo = $logoPath;
                    }
                    $album->save();
                }
            }

            Log::info("生成二维码: album_id={$albumId}, path={$relativePath}");
            $targetName = '';
            if ($albumId > 0 && isset($album)) {
                $targetName = $album->title;
            }
            AuditWriter::logQrcode('album', $albumId, $targetName, [
                'qrcode_image'    => $relativePath,
                'qrcode_logo'     => $logoPath,
                'qrcode_text_line1' => $textLine1,
                'qrcode_text_line2' => $textLine2,
                'content'         => substr($content, 0, 200),
            ]);

            return json_success([
                'path' => $relativePath,
                'url'  => get_upload_url($relativePath),
            ], '二维码生成成功');
        } catch (\Exception $e) {
            Log::error("二维码生成失败: " . $e->getMessage());
            return json_error('二维码生成失败，请稍后重试');
        }
    }

    private function compositeQrImage(string $qrImageData, string $logoPath, string $textLine1, string $textLine2)
    {
        $qrImage = imagecreatefromstring($qrImageData);
        $qrWidth = imagesx($qrImage);
        $qrHeight = imagesy($qrImage);

        $padding = 30;
        $textAreaHeight = 0;
        $lineHeight = 32;

        if (!empty($textLine1)) $textAreaHeight += $lineHeight + 10;
        if (!empty($textLine2)) $textAreaHeight += $lineHeight + 10;
        if ($textAreaHeight > 0) $textAreaHeight += 20;

        $totalWidth = $qrWidth + $padding * 2;
        $totalHeight = $qrHeight + $padding * 2 + $textAreaHeight;

        $canvas = imagecreatetruecolor($totalWidth, $totalHeight);

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);

        $shadowColor = imagecolorallocatealpha($canvas, 0, 0, 0, 100);
        self::filledRoundedRect($canvas, $padding - 5 + 3, $padding - 5 + 3, $padding + $qrWidth + 5 + 3, $padding + $qrHeight + 5 + 3, 12, $shadowColor);

        $borderColor = imagecolorallocate($canvas, 240, 240, 240);
        self::filledRoundedRect($canvas, $padding - 5, $padding - 5, $padding + $qrWidth + 5, $padding + $qrHeight + 5, 12, $borderColor);

        imagecopy($canvas, $qrImage, $padding, $padding, 0, 0, $qrWidth, $qrHeight);

        if (!empty($logoPath)) {
            $fullLogoPath = app()->getRootPath() . 'public/uploads/' . $logoPath;
            if (file_exists($fullLogoPath)) {
                $this->drawRoundedLogo($canvas, $fullLogoPath, $totalWidth / 2, $padding + $qrHeight / 2, 45);
            }
        }

        if (!empty($textLine1) || !empty($textLine2)) {
            $textColor = imagecolorallocate($canvas, 51, 51, 51);
            $fontFile = $this->getFontPath();
            $yPos = $padding + $qrHeight + 25;

            if (!empty($textLine1)) {
                if ($fontFile && file_exists($fontFile)) {
                    $bbox = imagettfbbox(14, 0, $fontFile, $textLine1);
                    $textWidth = $bbox[2] - $bbox[0];
                    $x = ($totalWidth - $textWidth) / 2;
                    imagettftext($canvas, 14, 0, (int)$x, $yPos, $textColor, $fontFile, $textLine1);
                } else {
                    $textWidth = strlen($textLine1) * 8;
                    $x = ($totalWidth - $textWidth) / 2;
                    imagestring($canvas, 4, (int)$x, $yPos - 10, $textLine1, $textColor);
                }
                $yPos += $lineHeight + 5;
            }

            if (!empty($textLine2)) {
                $subColor = imagecolorallocate($canvas, 102, 102, 102);
                if ($fontFile && file_exists($fontFile)) {
                    $bbox = imagettfbbox(12, 0, $fontFile, $textLine2);
                    $textWidth = $bbox[2] - $bbox[0];
                    $x = ($totalWidth - $textWidth) / 2;
                    imagettftext($canvas, 12, 0, (int)$x, $yPos, $subColor, $fontFile, $textLine2);
                } else {
                    $textWidth = strlen($textLine2) * 7;
                    $x = ($totalWidth - $textWidth) / 2;
                    imagestring($canvas, 3, (int)$x, $yPos - 10, $textLine2, $subColor);
                }
            }
        }

        imagedestroy($qrImage);

        return $canvas;
    }

    private function drawRoundedLogo($canvas, string $logoPath, float $centerX, float $centerY, int $size)
    {
        $ext = strtolower(pathinfo($logoPath, PATHINFO_EXTENSION));
        $logoImage = null;

        switch ($ext) {
            case 'png':
                $logoImage = @imagecreatefrompng($logoPath);
                break;
            case 'jpg':
            case 'jpeg':
                $logoImage = @imagecreatefromjpeg($logoPath);
                break;
            case 'gif':
                $logoImage = @imagecreatefromgif($logoPath);
                break;
        }

        if (!$logoImage) return;

        $logoW = imagesx($logoImage);
        $logoH = imagesy($logoImage);

        $resized = imagecreatetruecolor($size * 2, $size * 2);
        imagesavealpha($resized, true);
        $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
        imagefill($resized, 0, 0, $transparent);

        imagecopyresampled($resized, $logoImage, 0, 0, 0, 0, $size * 2, $size * 2, $logoW, $logoH);

        $rounded = imagecreatetruecolor($size * 2, $size * 2);
        imagesavealpha($rounded, true);
        $transparent2 = imagecolorallocatealpha($rounded, 0, 0, 0, 127);
        imagefill($rounded, 0, 0, $transparent2);

        $radius = 10;
        self::filledRoundedRect($rounded, 0, 0, $size * 2 - 1, $size * 2 - 1, $radius, imagecolorallocate($rounded, 255, 255, 255));

        for ($x = 0; $x < $size * 2; $x++) {
            for ($y = 0; $y < $size * 2; $y++) {
                $maskColor = imagecolorat($rounded, $x, $y);
                $maskAlpha = ($maskColor >> 24) & 0x7F;
                if ($maskAlpha < 127) {
                    $srcColor = imagecolorat($resized, $x, $y);
                    imagesetpixel($canvas, (int)($centerX - $size + $x), (int)($centerY - $size + $y), $srcColor);
                }
            }
        }

        $shadowColor = imagecolorallocatealpha($canvas, 0, 0, 0, 110);
        $x1 = (int)($centerX - $size - 2);
        $y1 = (int)($centerY - $size - 2);
        $x2 = (int)($centerX + $size + 2);
        $y2 = (int)($centerY + $size + 2);
        imagerectangle($canvas, $x1 + 2, $y1 + 2, $x2 + 2, $y2 + 2, $shadowColor);

        $borderColor = imagecolorallocate($canvas, 255, 255, 255);
        for ($i = 0; $i < 3; $i++) {
            imagerectangle($canvas, $x1 + $i, $y1 + $i, $x2 - $i, $y2 - $i, $borderColor);
        }

        imagedestroy($logoImage);
        imagedestroy($resized);
        imagedestroy($rounded);
    }

    private function getFontPath(): string
    {
        $possiblePaths = [
            '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/noto/NotoSansSC-Regular.otf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return '';
    }

    private static function filledRoundedRect($image, $x1, $y1, $x2, $y2, $radius, $color)
    {
        imagefilledrectangle($image, $x1 + $radius, $y1, $x2 - $radius, $y2, $color);
        imagefilledrectangle($image, $x1, $y1 + $radius, $x2, $y2 - $radius, $color);

        imagefilledellipse($image, $x1 + $radius, $y1 + $radius, $radius * 2, $radius * 2, $color);
        imagefilledellipse($image, $x2 - $radius, $y1 + $radius, $radius * 2, $radius * 2, $color);
        imagefilledellipse($image, $x1 + $radius, $y2 - $radius, $radius * 2, $radius * 2, $color);
        imagefilledellipse($image, $x2 - $radius, $y2 - $radius, $radius * 2, $radius * 2, $color);
    }
}
