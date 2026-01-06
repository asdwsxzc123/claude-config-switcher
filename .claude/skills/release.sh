#!/bin/bash

# Release Skill - 自动化版本发布流程
# Usage: /release [patch|minor|major] [-y]

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

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo -e "${CYAN}当前版本: ${YELLOW}v${CURRENT_VERSION}${NC}\n"

# 检查 git 状态
echo -e "${BLUE}=== 检查 Git 状态 ===${NC}"
HAS_CHANGES=false
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}发现未提交的变更:${NC}"
    git status --short
    echo
    HAS_CHANGES=true

    # 显示改动统计
    echo -e "${BLUE}=== 改动统计 ===${NC}"
    git diff --stat
    echo
else
    echo -e "${GREEN}工作区干净，没有未提交的变更${NC}"
    echo -e "${CYAN}将直接升级版本并推送${NC}"
    echo
fi

# 获取版本类型参数
VERSION_TYPE="${ARGS[0]}"

# 如果没有提供版本类型，交互式询问
if [ -z "$VERSION_TYPE" ]; then
    echo -e "\n${CYAN}请选择版本升级类型:${NC}"
    echo -e "  ${GREEN}1)${NC} patch  - 补丁版本 (bug 修复)    ${GRAY}${CURRENT_VERSION} -> $(npm version patch --no-git-tag-version -s 2>/dev/null && node -p "require('./package.json').version" && npm version ${CURRENT_VERSION} --no-git-tag-version -s 2>/dev/null)${NC}"
    echo -e "  ${GREEN}2)${NC} minor  - 次要版本 (新功能)      ${GRAY}${CURRENT_VERSION} -> $(npm version minor --no-git-tag-version -s 2>/dev/null && node -p "require('./package.json').version" && npm version ${CURRENT_VERSION} --no-git-tag-version -s 2>/dev/null)${NC}"
    echo -e "  ${GREEN}3)${NC} major  - 主要版本 (破坏性更新) ${GRAY}${CURRENT_VERSION} -> $(npm version major --no-git-tag-version -s 2>/dev/null && node -p "require('./package.json').version" && npm version ${CURRENT_VERSION} --no-git-tag-version -s 2>/dev/null)${NC}"
    echo
    read -p "请输入选择 (1/2/3): " choice

    case $choice in
        1) VERSION_TYPE="patch" ;;
        2) VERSION_TYPE="minor" ;;
        3) VERSION_TYPE="major" ;;
        *)
            echo -e "${RED}无效的选择${NC}"
            exit 1
            ;;
    esac
fi

# 验证版本类型
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}错误: 版本类型必须是 patch, minor 或 major${NC}"
    exit 1
fi

echo -e "\n${CYAN}版本升级类型: ${YELLOW}${VERSION_TYPE}${NC}"

# 询问提交信息（仅在有变更时）
if [ "$HAS_CHANGES" = true ]; then
    if [ "$AUTO_CONFIRM" = false ]; then
        echo -e "\n${CYAN}请输入提交信息 (留空使用默认):${NC}"
        read -p "> " COMMIT_MSG
    fi

    if [ -z "$COMMIT_MSG" ]; then
        # 根据版本类型生成默认提交信息
        case $VERSION_TYPE in
            patch) COMMIT_MSG="fix: 修复问题和优化" ;;
            minor) COMMIT_MSG="feat: 添加新功能" ;;
            major) COMMIT_MSG="feat!: 重大更新" ;;
        esac
    fi
else
    COMMIT_MSG=""
fi

# 确认发布
if [ "$AUTO_CONFIRM" = false ]; then
    echo -e "\n${BLUE}=== 发布确认 ===${NC}"
    if [ "$HAS_CHANGES" = true ]; then
        echo -e "提交信息: ${GREEN}${COMMIT_MSG}${NC}"
    fi
    echo -e "版本类型: ${YELLOW}${VERSION_TYPE}${NC}"
    echo -e "当前版本: ${YELLOW}v${CURRENT_VERSION}${NC}"
    echo
    read -p "确认发布? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消发布${NC}"
        exit 0
    fi
else
    echo -e "\n${BLUE}=== 自动发布模式 ===${NC}"
    if [ "$HAS_CHANGES" = true ]; then
        echo -e "提交信息: ${GREEN}${COMMIT_MSG}${NC}"
    fi
    echo -e "版本类型: ${YELLOW}${VERSION_TYPE}${NC}"
    echo -e "当前版本: ${YELLOW}v${CURRENT_VERSION}${NC}"
    echo
fi

echo -e "\n${BLUE}=== 开始发布流程 ===${NC}\n"

STEP=1
TOTAL_STEPS=3

# 1. 提交代码（仅在有变更时）
if [ "$HAS_CHANGES" = true ]; then
    echo -e "${CYAN}[${STEP}/4] 提交代码...${NC}"
    git add .
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ 代码已提交${NC}\n"
    STEP=$((STEP + 1))
    TOTAL_STEPS=4
fi

# 2. 升级版本
echo -e "${CYAN}[${STEP}/${TOTAL_STEPS}] 升级版本...${NC}"
NEW_VERSION=$(npm version $VERSION_TYPE)
echo -e "${GREEN}✓ 版本已升级: ${YELLOW}${NEW_VERSION}${NC}\n"
STEP=$((STEP + 1))

# 3. 推送到远程
echo -e "${CYAN}[${STEP}/${TOTAL_STEPS}] 推送到 GitHub...${NC}"
git push
echo -e "${GREEN}✓ 代码已推送${NC}\n"
STEP=$((STEP + 1))

# 4. 推送标签
echo -e "${CYAN}[${STEP}/${TOTAL_STEPS}] 推送标签...${NC}"
git push --tags
echo -e "${GREEN}✓ 标签已推送${NC}\n"

# 获取仓库信息
REPO_URL=$(git config --get remote.origin.url | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')

# 显示成功信息
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 发布成功!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "新版本: ${YELLOW}${NEW_VERSION}${NC}"
echo
echo -e "${CYAN}GitHub Actions:${NC}"
echo -e "  ${REPO_URL}/actions"
echo
echo -e "${CYAN}GitHub Releases:${NC}"
echo -e "  ${REPO_URL}/releases"
echo
echo -e "${CYAN}NPM 包:${NC}"
echo -e "  https://www.npmjs.com/package/claude-code-switcher"
echo
echo -e "${GRAY}提示: GitHub Actions 会自动创建 Release 并发布到 NPM${NC}"
echo
