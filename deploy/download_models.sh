#!/bin/bash
# Channel Lab model weights. Small config/tokenizer files: hf-mirror.com at pinned HF revision.
# Large LFS weights: ModelScope mirror (hf-mirror redirects LFS to US xet CDN, ~40 KB/s here),
# each verified by sha256 against the HF LFS oid of the pinned revision.
set -u
BASE=/home/ubuntu/channel_lab_models
HF=https://hf-mirror.com
MS=https://www.modelscope.cn
dl() { # hfrepo rev msrepo dir files...
  local repo=$1 rev=$2 ms=$3 name=$4; shift 4; local dir=$BASE/$name; mkdir -p "$dir"
  local tree; tree=$(curl -s -m 30 "$HF/api/models/$repo/tree/$rev")
  for f in "$@"; do
    oid=$(echo "$tree" | python3 -c "import sys,json; d={x['path']:x for x in json.load(sys.stdin)}; print(d.get('$f',{}).get('lfs',{}).get('oid',''))")
    if [ -n "$oid" ]; then
      if [ -f "$dir/$f" ] && [ "$(sha256sum "$dir/$f" | cut -d' ' -f1)" = "$oid" ]; then echo "SKIP $name/$f already verified"; continue; fi
      rm -f "$dir/$f"; url="$MS/models/$ms/resolve/master/$f"
    else rm -f "$dir/$f"; url="$HF/$repo/resolve/$rev/$f"; fi
    t0=$(date +%s)
    for i in 1 2 3 4 5; do
      curl -sSL --fail -C - --retry 3 --speed-limit 50000 --speed-time 60 -m 3600 -o "$dir/$f" "$url" && break
      echo "retry $f ($i)"; sleep 5
    done
    sz=$(stat -c%s "$dir/$f"); dt=$(( $(date +%s)-t0 ))
    if [ -n "$oid" ]; then
      got=$(sha256sum "$dir/$f" | cut -d' ' -f1)
      [ "$got" = "$oid" ] && echo "OK   $name/$f $sz bytes ${dt}s sha256=$got (matches HF $repo@$rev) via ModelScope $ms" || echo "BAD  $name/$f sha mismatch ($got != $oid)"
    else echo "OK   $name/$f $sz bytes (hf-mirror)"; fi
  done
  echo "HF: $repo@$rev ; large weights via ModelScope $ms, sha256-verified against HF LFS oid" > "$dir/SOURCE.txt"
}
date
dl google/ddpm-cifar10-32 267b167dc01f0e4e61923ea244e8b988f84deb80 - ddpm-cifar10-32 config.json scheduler_config.json diffusion_pytorch_model.safetensors
dl google/vit-base-patch16-224 3f49326eb077187dfe1c2a2bb15fbd74e6ab91e3 google/vit-base-patch16-224 vit config.json preprocessor_config.json model.safetensors
dl facebook/sam-vit-base 70c1a07f894ebb5b307fd9eaaee97b9dfc16068f facebook/sam-vit-base sam config.json preprocessor_config.json model.safetensors
dl google-bert/bert-base-uncased 86b5e0934494bd15c9632b12f734a8a67f723594 google-bert/bert-base-uncased bert config.json tokenizer_config.json vocab.txt tokenizer.json model.safetensors
dl openai-community/gpt2 607a30d783dfa663caf39e06633721c8d4cfcd7e openai-community/gpt2 gpt2 config.json generation_config.json tokenizer_config.json vocab.json merges.txt tokenizer.json model.safetensors
dl openai/clip-vit-base-patch32 3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268 openai-mirror/clip-vit-base-patch32 clip-vit-base-patch32 config.json preprocessor_config.json tokenizer_config.json vocab.json merges.txt special_tokens_map.json tokenizer.json pytorch_model.bin
date; du -sh $BASE/*; echo ALLDONE
