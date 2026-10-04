"""官方数据下载与 MD5 校验。只将 data filter 允许的归档成员解压到 data。"""
import hashlib
import tarfile
import urllib.request
from .data import DATA

RESOURCES = {
    'images.tar.gz': ('https://thor.robots.ox.ac.uk/datasets/pets/images.tar.gz', '5c4f3ee8e5d25df40f4fd59a7f44e54c'),
    'annotations.tar.gz': ('https://thor.robots.ox.ac.uk/datasets/pets/annotations.tar.gz', '95a8c909bbe2e81eed6a22bccdf3f68f'),
}


def digest(path):
    result = hashlib.md5()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024*1024), b''):
            result.update(chunk)
    return result.hexdigest()


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in RESOURCES.items():
        archive = DATA/name
        if not archive.exists():
            partial = archive.with_suffix('.part')
            print('下载', url, flush=True)
            urllib.request.urlretrieve(url, partial)
            if digest(partial) != expected:
                raise RuntimeError(f'{name} 校验失败，请重试下载')
            partial.replace(archive)
        if digest(archive) != expected:
            raise RuntimeError(f'{archive} 校验失败，不解压该文件')
        print('校验通过，解压', name, flush=True)
        with tarfile.open(archive) as file:
            file.extractall(DATA, filter='data')
    print('数据已就绪', DATA)

if __name__ == '__main__':
    main()
