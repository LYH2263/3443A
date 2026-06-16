<?php

namespace app\service;

interface IpRegionParserInterface
{
    public function parse(string $ip): array;
}
