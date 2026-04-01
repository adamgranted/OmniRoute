#!/usr/bin/env bash
# OmniRoute CLI Bootstrap
# Configures coding CLI tools on this machine to use your OmniRoute instance.
# No secrets are embedded — you will be prompted for your API key.
#
# The OMNIROUTE_URL variable on the next line is injected by the server at serve time.
# %%OMNIROUTE_URL%%

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

say()  { printf "${GREEN}▸${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}▸${NC} %s\n" "$*"; }
err()  { printf "${RED}✘${NC} %s\n" "$*" >&2; }
header() { printf "\n${BOLD}${CYAN}%s${NC}\n" "$*"; }

# ── Logo ──
echo ""
echo -e "\033[38;2;180;60;60m   ╔════════════════════════════════════════╗\033[0m"
echo -e "\033[38;2;180;60;60m   ║                                        ║\033[0m"
echo -e "\033[38;2;180;60;60m   ║  \033[1;38;2;255;100;80m░█▀█░█▄█░█▀█░▀█▀░█▀▄░█▀█░█░█░▀█▀░█▀▀\033[38;2;180;60;60m  ║\033[0m"
echo -e "\033[38;2;180;60;60m   ║  \033[1;38;2;220;70;60m░█░█░█░█░█░█░░█░░█▀▄░█░█░█░█░░█░░█▀▀\033[38;2;180;60;60m  ║\033[0m"
echo -e "\033[38;2;180;60;60m   ║  \033[1;38;2;180;40;40m░▀▀▀░▀░▀░▀░▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░░▀░░▀▀▀\033[38;2;180;60;60m  ║\033[0m"
echo -e "\033[38;2;180;60;60m   ║                                        ║\033[0m"
echo -e "\033[38;2;180;60;60m   ╚════════════════════════════════════════╝\033[0m"
echo -e "${DIM}   CLI Bootstrap                       v%%VERSION%%${NC}"
echo ""
echo -e "   ${GREEN}●${NC} Instance: ${CYAN}${OMNIROUTE_URL}${NC}"
echo ""

# ── Connectivity check ──
if ! curl -sf "${OMNIROUTE_URL}/api/monitoring/health" -o /dev/null 2>/dev/null; then
  err "Cannot reach ${OMNIROUTE_URL} — check your network/VPN."
  exit 1
fi
say "Instance is reachable."
echo ""

# ── API Key ──
header "Authentication"
echo "Enter your OmniRoute API key (from Dashboard → API Keys)."
echo "The key starts with sk-"
echo ""
printf "${BOLD}API Key:${NC} "
read -rs API_KEY < /dev/tty
echo ""

if [ -z "${API_KEY}" ]; then
  err "No API key provided."
  exit 1
fi

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${API_KEY}" \
  "${OMNIROUTE_URL}/v1/models" 2>/dev/null)

if [ "${HTTP_CODE}" != "200" ]; then
  err "API key validation failed (HTTP ${HTTP_CODE})."
  err "Check that the key is correct and has not been revoked."
  exit 1
fi
say "API key validated."
echo ""

# ── CLI Detection ──
header "CLI Tools"

declare -A TOOL_NAMES=(
  [claude]="Claude Code"
  [codex]="OpenAI Codex CLI"
  [aider]="Aider"
  [cursor]="Cursor IDE"
  [cline]="Cline/Continue/RooCode"
)

declare -A TOOL_BINS=(
  [claude]="claude"
  [codex]="codex"
  [aider]="aider"
  [cursor]=""
  [cline]=""
)

DETECTED=()
NOT_DETECTED=()
for id in claude codex aider cursor cline; do
  bin="${TOOL_BINS[$id]}"
  if [ -n "${bin}" ] && command -v "${bin}" &>/dev/null; then
    DETECTED+=("${id}")
  else
    NOT_DETECTED+=("${id}")
  fi
done

SELECTED=()

if [ ${#DETECTED[@]} -gt 0 ]; then
  echo -e "  Detected on this machine:"
  for id in "${DETECTED[@]}"; do
    echo -e "    ${GREEN}●${NC} ${TOOL_NAMES[$id]} ${DIM}($(command -v "${TOOL_BINS[$id]}"))${NC}"
  done
  echo ""
  printf "  Configure all detected CLIs? [Y/n] "
  read -r auto_yn < /dev/tty
  case "${auto_yn}" in
    [Nn]*)
      for id in "${DETECTED[@]}"; do
        printf "    Configure ${BOLD}${TOOL_NAMES[$id]}${NC}? [y/N] "
        read -r yn < /dev/tty
        case "${yn}" in [Yy]*) SELECTED+=("${id}") ;; esac
      done
      ;;
    *)
      SELECTED=("${DETECTED[@]}")
      ;;
  esac
else
  warn "No CLI tools detected on this machine."
fi

if [ ${#NOT_DETECTED[@]} -gt 0 ]; then
  echo ""
  echo -e "  ${DIM}Not detected: $(printf '%s, ' "${NOT_DETECTED[@]}" | sed 's/, $//')${NC}"
  printf "  Show manual setup instructions for any of these? [y/N] "
  read -r manual_yn < /dev/tty
  case "${manual_yn}" in
    [Yy]*)
      for id in "${NOT_DETECTED[@]}"; do
        printf "    Include ${BOLD}${TOOL_NAMES[$id]}${NC}? [y/N] "
        read -r yn < /dev/tty
        case "${yn}" in [Yy]*) SELECTED+=("${id}") ;; esac
      done
      ;;
  esac
fi

if [ ${#SELECTED[@]} -eq 0 ]; then
  warn "No tools selected. Exiting."
  exit 0
fi

echo ""

# ── Default model ──
header "Default Model"
echo "Popular choices: cc/claude-opus-4-6, cx/gpt-5.2-codex, gc/gemini-2.5-pro"
printf "${BOLD}Model [cc/claude-opus-4-6]:${NC} "
read -r MODEL < /dev/tty
MODEL="${MODEL:-cc/claude-opus-4-6}"

echo ""
header "Configuring..."

# ── Detect shell profile ──
detect_profile() {
  if [ -f "${HOME}/.zshrc" ]; then echo "${HOME}/.zshrc"
  elif [ -f "${HOME}/.bashrc" ]; then echo "${HOME}/.bashrc"
  elif [ -f "${HOME}/.bash_profile" ]; then echo "${HOME}/.bash_profile"
  else echo "${HOME}/.profile"
  fi
}

PROFILE=$(detect_profile)
PROFILE_MODIFIED=false
ENVS_WRITTEN=()

add_env_to_profile() {
  local var_name="$1" var_value="$2"

  for written in "${ENVS_WRITTEN[@]+"${ENVS_WRITTEN[@]}"}"; do
    if [ "${written}" = "${var_name}=${var_value}" ]; then
      return
    fi
  done

  if grep -q "^export ${var_name}=" "${PROFILE}" 2>/dev/null; then
    grep -v "^export ${var_name}=" "${PROFILE}" > "${PROFILE}.omniroute-tmp"
    mv "${PROFILE}.omniroute-tmp" "${PROFILE}"
  fi
  echo "export ${var_name}=\"${var_value}\"" >> "${PROFILE}"
  ENVS_WRITTEN+=("${var_name}=${var_value}")
  PROFILE_MODIFIED=true
}

# ── Configure each selected tool ──
for tool in "${SELECTED[@]}"; do
  case "${tool}" in

    claude)
      say "Configuring Claude Code..."
      if command -v claude &>/dev/null; then
        # Check for existing auth that would override env vars (timeout after 5s)
        if timeout 5 claude status 2>/dev/null | grep -qi "logged in\|authenticated\|active"; then
          warn "  Claude Code has an existing login session."
          echo "  The env vars won't take effect until you log out."
          printf "  Run ${BOLD}claude logout${NC} now? [Y/n] "
          read -r logout_yn < /dev/tty
          case "${logout_yn}" in
            [Nn]*) warn "  Skipping — you may need to run 'claude logout' manually." ;;
            *) claude logout 2>/dev/null && say "  Logged out of Claude Code." ;;
          esac
        fi
      fi
      add_env_to_profile "ANTHROPIC_BASE_URL" "${OMNIROUTE_URL}/v1"
      add_env_to_profile "ANTHROPIC_API_KEY" "${API_KEY}"
      echo "  Added ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY to ${PROFILE}"
      ;;

    codex)
      say "Configuring Codex CLI..."
      # Clean up deprecated env vars from previous bootstrap runs
      for old_var in OPENAI_BASE_URL OPENAI_API_KEY; do
        if grep -q "^export ${old_var}=" "${PROFILE}" 2>/dev/null; then
          grep -v "^export ${old_var}=" "${PROFILE}" > "${PROFILE}.omniroute-tmp"
          mv "${PROFILE}.omniroute-tmp" "${PROFILE}"
          say "  Removed deprecated ${old_var} from ${PROFILE}"
        fi
      done
      mkdir -p "${HOME}/.codex"
      CODEX_CONFIG="${HOME}/.codex/config.toml"
      PROVIDER_BLOCK="model_provider = \"omniroute\"

[model_providers.omniroute]
name = \"OmniRoute\"
base_url = \"${OMNIROUTE_URL}/v1\"
wire_api = \"responses\"
env_key = \"OMNIROUTE_API_KEY\"

[profiles.default]
model_provider = \"omniroute\"
model = \"${MODEL}\""

      if [ -f "${CODEX_CONFIG}" ]; then
        if grep -q '\[model_providers\.omniroute\]' "${CODEX_CONFIG}" 2>/dev/null; then
          say "  Updating existing OmniRoute config in ${CODEX_CONFIG}"
          python3 -c "
import re
with open('${CODEX_CONFIG}') as f: txt = f.read()
txt = re.sub(r'\n*\[model_providers\.omniroute\][^\[]*', '', txt)
txt = re.sub(r'^model_provider\s*=\s*\"omniroute\"\n?', '', txt, flags=re.MULTILINE)
txt = re.sub(r'\n*\[profiles\.default\][^\[]*', '', txt)
with open('${CODEX_CONFIG}', 'w') as f: f.write(txt.strip() + '\n')
" 2>/dev/null || warn "  Could not remove old block. Edit ${CODEX_CONFIG} manually."
        fi
        echo "" >> "${CODEX_CONFIG}"
        echo "${PROVIDER_BLOCK}" >> "${CODEX_CONFIG}"
        say "  Written OmniRoute config to ${CODEX_CONFIG}"
      else
        echo "${PROVIDER_BLOCK}" > "${CODEX_CONFIG}"
        say "  Created ${CODEX_CONFIG}"
      fi
      add_env_to_profile "OMNIROUTE_API_KEY" "${API_KEY}"
      ;;

    aider)
      say "Configuring Aider..."
      add_env_to_profile "OPENAI_API_BASE" "${OMNIROUTE_URL}/v1"
      add_env_to_profile "OPENAI_API_KEY" "${API_KEY}"
      echo "  Added OPENAI_API_BASE and OPENAI_API_KEY to ${PROFILE}"
      ;;

    cursor)
      say "Cursor IDE — configure via the GUI:"
      echo "    Settings (Cmd+, / Ctrl+,) → Models → Advanced"
      echo "    OpenAI API Base URL: ${OMNIROUTE_URL}/v1"
      echo "    OpenAI API Key:      (your OmniRoute key)"
      echo "    Model:               ${MODEL}"
      ;;

    cline)
      say "Cline / Continue / RooCode — configure via the extension:"
      echo "    Provider: OpenAI Compatible"
      echo "    Base URL: ${OMNIROUTE_URL}/v1"
      echo "    API Key:  (your OmniRoute key)"
      echo "    Model:    ${MODEL}"
      ;;
  esac
done

echo ""
header "Done!"

say "Your CLIs are now pointed at: ${OMNIROUTE_URL}"
say "Default model: ${MODEL}"
echo ""
echo "Test with:  curl -s -H 'Authorization: Bearer YOUR_KEY' ${OMNIROUTE_URL}/v1/models | head -c 200"
echo ""

if [ "${PROFILE_MODIFIED}" = true ]; then
  warn "Shell profile updated (${PROFILE})."
  warn "If env vars aren't picked up, run: source ${PROFILE}"
  echo ""
  warn "Spawning a new shell with env vars loaded..."
  exec "${SHELL:-bash}" -l
fi
