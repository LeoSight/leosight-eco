const gulp = require('gulp');
const plumber = require('gulp-plumber');
const concat = require('gulp-concat');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const less = require('gulp-less');
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const imagemin = require('gulp-imagemin');
const cache = require('gulp-cache');

const JS_SOURCE = 'src/js';
const JS_DEST = 'client/js';
const CSS_SOURCE = 'src/css';
const CSS_DEST = 'client/css';
const IMAGE_SOURCE = 'src/images';
const IMAGE_DEST = 'client/images';

function scripts() {
    return gulp.src([
        'node_modules/jquery/dist/jquery.min.js',
        'node_modules/jquery-contextmenu/dist/jquery.contextMenu.min.js',
        'node_modules/micromodal/dist/micromodal.min.js',
        JS_SOURCE + '/**/*.js'
    ]).pipe(plumber({
            errorHandler: function (error) {
                console.log(error.message);
                generator.emit('end');
            }
        }))
        .pipe(babel({
            presets: ['@babel/env'],
            //compact: false
            minified: true
        }))
        .pipe(concat('scripts.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest(JS_DEST + '/'))
}

function css() {
    return gulp.src([
        'node_modules/jquery-contextmenu/dist/jquery.contextMenu.min.css',
        CSS_SOURCE + '/**/*.less'
    ]).pipe(plumber({
            errorHandler: function (error) {
                console.log(error.message);
                generator.emit('end');
            }
        }))
        .pipe(less())
        .pipe(autoprefixer('last 2 versions'))
        .pipe(concat('style.min.css'))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(gulp.dest(CSS_DEST + '/'))
}

function images() {
    return gulp.src(IMAGE_SOURCE + '/**/*')
        .pipe(cache(imagemin({optimizationLevel: 3, progressive: true, interlaced: true})))
        .pipe(gulp.dest(IMAGE_DEST + '/'));
}

function watch() {
    gulp.watch(CSS_SOURCE + '/**/*.less', css);
    gulp.watch(JS_SOURCE + '/**/*.js', scripts);
    gulp.watch(IMAGE_SOURCE + '/**/*', images);
}

const main = gulp.parallel(css, scripts, images, watch);

exports.default = main;