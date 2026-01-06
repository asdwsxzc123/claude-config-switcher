#!/bin/bash

# Push Skill - 快速提交并推送代码
# Usage: /push [commit-message] [-y]

set -e

# 检查是否有 -y 参数
AUTO_CONFIRM=false
ARGS=()
for arg in "$@"; do
    if [ "$arg" = "-y" ] || [ "$arg" = "--yes" ]; then
        AUTO_CONFIRM=true
    else
        ARGS+=("$arg")
    fi
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}错误: 当前目录不是 git 仓库${NC}"
    exit 1
fi

# 检查 git 状态
echo -e "${BLUE}=== Git 状态 ===${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}将要提交的文件:${NC}"
    git status --short
    echo
else
    echo -e "${GREEN}工作区干净，没有需要提交的变更${NC}"
    exit 0
fi

# 显示改动统计
echo -e "${BLUE}=== 改动统计 ===${NC}"
git diff --stat
echo

# 获取提交信息
COMMIT_MSG="${ARGS[*]}"

if [ -z "$COMMIT_MSG" ]; then
    echo -e "${CYAN}请输入提交信息:${NC}"
    read -p "> " COMMIT_MSG

    if [ -z "$COMMIT_MSG" ]; then
        echo -e "${RED}错误: 提交信息不能为空${NC}"
        exit 1
    fi
fi

# 确认推送
if [ "$AUTO_CONFIRM" = false ]; then
    echo -e "\n${BLUE}=== 推送确认 ===${NC}"
    echo -e "提交信息: ${GREEN}${COMMIT_MSG}${NC}"
    echo
    read -p "确认推送? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消推送${NC}"
        exit 0
    fi
else
    echo -e "\n${BLUE}=== 自动推送模式 ===${NC}"
    echo -e "提交信息: ${GREEN}${COMMIT_MSG}${NC}"
    echo
fi

echo -e "\n${CYAN}正在推送...${NC}\n"

# 执行推送
git add .
git commit -m "$COMMIT_MSG"
git push

# 显示成功信息
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 推送成功!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# 获取仓库信息
REPO_URL=$(git config --get remote.origin.url | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo -e "${CYAN}分支: ${YELLOW}${BRANCH}${NC}"
echo -e "${CYAN}查看提交: ${NC}${REPO_URL}/commits/${BRANCH}"
echo
