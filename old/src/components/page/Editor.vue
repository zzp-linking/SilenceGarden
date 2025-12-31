<template>
  <div class="write-container">
    <div class="settings">
      <Form ref="form" :model="form" inline :rules="ruels">
        <div style="max-width: 1200px;margin: 0 auto;">
          <div class="two-content">
            <FormItem prop="title">
              <Input type="text" v-model="form.title" placeholder="Title" style="width: 200px">
              <Icon type="ios-person-outline" slot="prepend"></Icon>
              </Input>
            </FormItem>
            <FormItem prop="tag">
              <Input type="text" v-model="form.tag" placeholder="Tag" style="width: 200px">
              <Icon type="ios-person-outline" slot="prepend"></Icon>
              </Input>
            </FormItem>
            <FormItem>
              <Button type="primary" @click="addTag">添加标签</Button>
              <Button type="primary" @click="handleSubmit('form')">发布</Button>
            </FormItem>
          </div>
          <div class="two-content">
            <Tag closable color="green" v-for="item,index in tags" :key="index" @on-close="deleteTip(item)">{{ item }}</Tag>
          </div>
        </div>
      </Form>
    </div>
    <mavon-editor ref=md v-model="markdown.value" class="editor" @imgAdd="$imgAdd" @save="save" @change="save"></mavon-editor>
  </div>
</template>

<script>
  import { mavonEditor } from 'mavon-editor'
  import 'mavon-editor/dist/css/index.css'
  export default {
    data() {
      return {
        markdown: {
          value: '',
          html: ''
        },
        tags: [],
        form: {
          title: '',
          tag: ''
        },
        ruels: {
          title: [
            { required: true, message: '标题不能为空', trigger: 'blur' }
          ]
        }
      }
    },
    components: {
      mavonEditor
    },
    created () {
      const id = this.$route.params.id
      id && this.$store.dispatch('getReviseArticleDetails', { id })
    },
    computed: {
      upload_image () {
        return this.$store.state.article.upload_image
      },
      revise_article () {
        return this.$store.state.article.revise_article
      }
    },
    watch: {
      upload_image (val) {
        const pos = this.$store.state.article.pos
        this.$refs.md.$img2Url(pos, '/assets/image/article/upload/' + val);
      },
      revise_article (val) {
        console.log('render___________________', val)
        this.markdown.value = val.markdown
        this.form.title = val.title
        this.tags = val.tags
      }
    },
    methods: {
      handleSubmit(name) {
        this.$refs[name].validate((valid) => {
          if (valid) {
            this.$store.dispatch('articleSave', {
              title: this.form.title,
              tags: this.tags,
              markdown: this.markdown.value,
              html: this.markdown.html
            })

          } else {
            this.$Message.error('Fail!');
          }
        })
      },
      addTag () {
        this.form.tag && this.tags.push(this.form.tag)
        this.form.tag = undefined
      },
      deleteTip (tag) {
        this.tags.splice(this.tags.indexOf(tag), 1)
      },
      save (value, render) {
        this.markdown.html = render
      },
      publish () {
      },
      $imgAdd (pos, $file) {
        const formdata = new FormData();
        formdata.append('image', $file);
        this.$store.dispatch('articleImageUpload', { formdata, pos })
      }
    }
  }

</script>

<style lang="less" scoped="scoped">
  .write-container {
    height: 100vh;
  }

  .settings {
    background: linear-gradient(to right, yellow, darkseagreen);
    height: 80px;
    padding: 5px 0;
  }
  .two-content{
    overflow: hidden;
    display: inline-block;
    width: 49%;
    vertical-align: top;
  }
  .editor{
    height: calc(100vh - 80px);
    z-index: 1000;
  }
</style>
