if [ $# -lt 2 ]
    then
        echo "Usage: giv-giv-histogram.sh <length> <width>"
        exit 1
fi
length=$1
width=$2

python extract_features_giv_giv.py --dir /homes/urialon/js_training/ --max_path_length ${length} --max_path_width ${width} > js${length}x${width}-giv-giv.txt 2> paths-nohup.out
python infHistogram.py js${length}x${width}-giv-giv.txt --include_giv > js${length}x${width}-giv-giv-histogram.txt