#!/bin/sh
# Longest run of consecutive comment lines in each file given as an argument.
for f in "$@"; do
  awk -v F="$f" '/^[[:space:]]*(\/\/|\/\*|\*)/{r++; if(r>m){m=r;s=NR}; next} {r=0} END{ if(m>3) print F": "m" lines at "s; }' "$f"
done
