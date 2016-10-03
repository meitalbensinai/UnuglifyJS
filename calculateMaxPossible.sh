python extract_features.py --dir /home/urialon/mining-clean2/home/urialon/mining/topforks/  --max_path_length 7 --max_path_width 3 > topforks2_features_7x3 2> extraction_errors.out &
python infHistogram.py ../../pom3/UnuglifyJS/training_jsnice_7x3 --include_giv > training_7x3_histogram
python infHistogram.py topforks2_features_7x3 > topforks_7x3_histogram
python calculateMaxPossible.py training_7x3_histogram topforks_7x3_histogram