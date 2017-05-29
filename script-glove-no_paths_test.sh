#if [ $# -lt 2 ]
#    then
#        echo "Usage: script-glove.sh <length> <width>"
#        exit 1
#fi
length=4
width=1

python extract_features_to_glove_no_paths_test.py --dir /scratch/urialon/js_topstars/topstars --max_path_length ${length} --max_path_width ${width} > glove_models/js_topstars${length}x${width}_no_paths.txt 2> paths-nohup.out
#cd ../glove/
#./uridemo.sh ${length} ${width}
