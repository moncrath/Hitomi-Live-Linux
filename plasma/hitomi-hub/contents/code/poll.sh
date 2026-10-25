#!/bin/sh
# Satu kali baca status sistem, keluaran key=value per baris. Hanya membaca.
# Laju CPU dan jaringan dihitung dari dua sampel berjarak 0,4 s.

cpu() { awk '/^cpu /{print $2+$3+$4+$7+$8, $2+$3+$4+$5+$6+$7+$8}' /proc/stat; }
net() { awk -F'[: ]+' 'NR>2 && $2!="lo"{rx+=$3; tx+=$11} END{print rx+0, tx+0}' /proc/net/dev; }

set -- $(cpu); b1=$1; t1=$2
set -- $(net); r1=$1; x1=$2
sleep 0.4
set -- $(cpu); b2=$1; t2=$2
set -- $(net); r2=$1; x2=$2

dt=$((t2 - t1)); [ "$dt" -gt 0 ] || dt=1
echo "cpu=$(( (b2 - b1) * 100 / dt ))"
echo "rx=$(( (r2 - r1) * 5 / 2 ))"
echo "tx=$(( (x2 - x1) * 5 / 2 ))"
awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "ram=%d\n", (t - a) * 100 / t}' /proc/meminfo
echo "gpu=$(timeout 2 nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -n1)"
echo "wifi=$(timeout 2 nmcli -t -f WIFI radio 2>/dev/null)"
echo "bt=$(timeout 2 bluetoothctl show 2>/dev/null | awk '/Powered:/{print $2}')"
echo "vol=$(timeout 2 wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null | awk '{print $2}')"
echo "bri=$(timeout 2 qdbus6 org.kde.ScreenBrightness /org/kde/ScreenBrightness/display0 org.kde.ScreenBrightness.Display.Brightness 2>/dev/null)"
